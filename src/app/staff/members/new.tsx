import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useCreateMember, type NewMemberFields } from '@/features/staff/members';
import {
  Actions,
  Button,
  Chip,
  Form,
  InputField,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  Text,
  space,
  type,
} from '@/ui';

/**
 * Add a member.
 *
 * The one thing worth saying loudly on this screen: creating a member does NOT
 * activate them. The server sets every new member `inactive` on purpose -
 * creating a record and admitting someone to the association are separate
 * decisions, and collapsing them would destroy the approval record the
 * association relies on. Staff who are not told this will create a member, hand
 * them a password, and field a phone call when they cannot sign in.
 *
 * Only `name` and `mobile` are required by the API. Everything else is offered
 * because it is far easier to capture at the counter than to chase later - and
 * because most of it is NOT editable afterwards through this app.
 */
export default function NewMemberScreen() {
  const create = useCreateMember();
  const [fields, setFields] = useState<NewMemberFields>({ name: '', mobile: '' });

  const set = (key: keyof NewMemberFields) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  const canSubmit = fields.name.trim().length > 0 && fields.mobile.trim().length > 0;

  /*
   * Field-level messages from the server.
   *
   * "mobile has already been taken" against the mobile box is actionable;
   * the same words in a banner at the top of a twelve-field form are a puzzle.
   */
  const fieldErrors =
    create.error instanceof ApiError ? ((create.error.details ?? {}) as Record<string, string[]>) : {};

  const submit = async () => {
    try {
      const member = await create.mutateAsync({
        ...fields,
        name: fields.name.trim(),
        mobile: fields.mobile.trim(),
        // Nullable and unique: '' would collide between any two members left
        // blank, so an empty box has to mean "not recorded".
        email: fields.email?.trim() ? fields.email.trim() : null,
      });

      // Straight to the new member, where the approve action is - the next
      // thing anyone doing this actually wants.
      router.replace(`/staff/members/${member.id}`);
    } catch {
      // Surfaced inline.
    }
  };

  return (
    <Screen width="reading">
      <ScreenHeader
        title="Add member"
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <View style={{ marginTop: space.lg }}>
        <Panel>
          <Text style={type.rowTitle}>They will not be active yet</Text>
          <Text style={type.body}>
            New members are created awaiting approval. Approve them on their page once the
            association has agreed to admit them — they cannot sign in until you do.
          </Text>
        </Panel>
      </View>

      {create.isError && Object.keys(fieldErrors).length === 0 ? (
        <View style={{ marginTop: space.lg }}>
          <Panel tone="danger">
            <Text style={type.body}>
              {create.error instanceof ApiError
                ? create.error.message
                : 'The member could not be created.'}
            </Text>
          </Panel>
        </View>
      ) : null}

      <Section title="Who they are">
        <Form maxWidth={null}>
          <InputField
            label="Name"
            required
            value={fields.name}
            onChangeText={set('name')}
            error={fieldErrors.name?.[0]}
          />
          <InputField
            label="Mobile"
            required
            value={fields.mobile}
            onChangeText={set('mobile')}
            keyboardType="phone-pad"
            error={fieldErrors.mobile?.[0]}
          />
          <InputField
            label="Email"
            value={fields.email ?? ''}
            onChangeText={set('email')}
            keyboardType="email-address"
            error={fieldErrors.email?.[0]}
          />
          <InputField
            label="Father's name"
            value={fields.father_name ?? ''}
            onChangeText={set('father_name')}
            error={fieldErrors.father_name?.[0]}
          />
          <InputField
            label="Mother's name"
            value={fields.mother_name ?? ''}
            onChangeText={set('mother_name')}
            error={fieldErrors.mother_name?.[0]}
          />
          <InputField
            label="BCS batch"
            value={fields.bcs_batch ?? ''}
            onChangeText={set('bcs_batch')}
            error={fieldErrors.bcs_batch?.[0]}
          />

          {/*
            Text inputs rather than a picker: HeroUI Native ships no date picker
            (R-1), and a hand-rolled calendar is not worth building for two
            optional fields. The placeholder carries the format the API expects;
            the server validates it, so a wrong entry is refused rather than
            silently stored.
          */}
          <InputField
            label="Joining date"
            placeholder="YYYY-MM-DD"
            value={fields.joining_date ?? ''}
            onChangeText={set('joining_date')}
            error={fieldErrors.joining_date?.[0]}
          />
          <InputField
            label="Date of birth"
            placeholder="YYYY-MM-DD"
            value={fields.birth_date ?? ''}
            onChangeText={set('birth_date')}
            error={fieldErrors.birth_date?.[0]}
          />

          <View style={{ gap: space.sm }}>
            <Text tone="muted" style={type.rowMeta}>Gender</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {/* Chip is pressable itself; no wrapper needed. */}
              {(['male', 'female', 'other'] as const).map((option) => (
                <Chip
                  size="sm"
                  key={option}
                  variant={fields.gender === option ? 'primary' : 'secondary'}
                  onPress={() => set('gender')(option)}
                >
                  <Chip.Label>{option}</Chip.Label>
                </Chip>
              ))}
            </View>
          </View>

          <InputField
            label="NID"
            value={fields.nid ?? ''}
            onChangeText={set('nid')}
            error={fieldErrors.nid?.[0]}
          />
          <InputField
            label="Present address"
            value={fields.present_address ?? ''}
            onChangeText={set('present_address')}
            error={fieldErrors.present_address?.[0]}
          />
          <InputField
            label="Permanent address"
            value={fields.permanent_address ?? ''}
            onChangeText={set('permanent_address')}
            error={fieldErrors.permanent_address?.[0]}
          />
        </Form>
      </Section>

      <Actions>
        <Button isDisabled={!canSubmit || create.isPending} onPress={() => void submit()}>
          <Button.Label>{create.isPending ? 'Creating…' : 'Create member'}</Button.Label>
        </Button>
      </Actions>
    </Screen>
  );
}
