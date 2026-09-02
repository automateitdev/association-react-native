import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useCreateMember, type NewMemberFields } from '@/features/staff/members';
import {
  Actions,
  Button,
  Chip,
  FieldError,
  Input,
  Label,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  Text,
  TextField,
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
      <Field
        label="Name"
        required
        value={fields.name}
        onChangeText={set('name')}
        errors={fieldErrors.name}
      />
      <Field
        label="Mobile"
        required
        value={fields.mobile}
        onChangeText={set('mobile')}
        keyboardType="phone-pad"
        errors={fieldErrors.mobile}
      />
      <Field
        label="Email"
        value={fields.email ?? ''}
        onChangeText={set('email')}
        keyboardType="email-address"
        errors={fieldErrors.email}
      />
      <Field
        label="Father's name"
        value={fields.father_name ?? ''}
        onChangeText={set('father_name')}
        errors={fieldErrors.father_name}
      />
      <Field
        label="Mother's name"
        value={fields.mother_name ?? ''}
        onChangeText={set('mother_name')}
        errors={fieldErrors.mother_name}
      />
      <Field
        label="BCS batch"
        value={fields.bcs_batch ?? ''}
        onChangeText={set('bcs_batch')}
        errors={fieldErrors.bcs_batch}
      />

      {/*
        Text inputs rather than a picker: HeroUI Native ships no date picker
        (R-1), and a hand-rolled calendar is not worth building for two optional
        fields. The hint carries the format the API expects; the server
        validates it, so a wrong entry is refused rather than silently stored.
      */}
      <Field
        label="Joining date"
        hint="YYYY-MM-DD"
        value={fields.joining_date ?? ''}
        onChangeText={set('joining_date')}
        errors={fieldErrors.joining_date}
      />
      <Field
        label="Date of birth"
        hint="YYYY-MM-DD"
        value={fields.birth_date ?? ''}
        onChangeText={set('birth_date')}
        errors={fieldErrors.birth_date}
      />

      <View style={{ gap: space.sm, marginTop: space.md }}>
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

      <Field
        label="NID"
        value={fields.nid ?? ''}
        onChangeText={set('nid')}
        errors={fieldErrors.nid}
      />
      <Field
        label="Present address"
        value={fields.present_address ?? ''}
        onChangeText={set('present_address')}
        errors={fieldErrors.present_address}
      />
      <Field
        label="Permanent address"
        value={fields.permanent_address ?? ''}
        onChangeText={set('permanent_address')}
        errors={fieldErrors.permanent_address}
      />

      </Section>

      <Actions>
        <Button isDisabled={!canSubmit || create.isPending} onPress={() => void submit()}>
          <Button.Label>{create.isPending ? 'Creating…' : 'Create member'}</Button.Label>
        </Button>
      </Actions>
    </Screen>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  required = false,
  hint,
  errors,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'phone-pad' | 'email-address';
  required?: boolean;
  hint?: string;
  errors?: string[];
}) {
  return (
    // isRequired draws the asterisk itself; the label used to concatenate one.
    // isInvalid propagates through TextField's form-item-state context, so Label,
    // Input and FieldError all pick up the invalid styling without being told.
    <TextField isRequired={required} isInvalid={Boolean(errors?.length)}>
      <Label>{label}</Label>
      <Input
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={hint}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
      {/*
        FieldError, not Description: this is what went wrong, not a hint.

        TWO NON-OBVIOUS PROPS, BOTH LOAD-BEARING.

        `isInvalid` explicitly, rather than relying on TextField's form-item
        context: FieldError renders null unless it believes the field is
        invalid, and not depending on ambient state is the safer call for the
        one component whose whole job is to appear when something is wrong.

        `animation={false}` because the default entering animation leaves the
        element at `visibility: hidden` on React Native Web and never reveals
        it. The message was in the DOM, 20pt tall, full opacity, and completely
        invisible - after the 422 had already arrived. Disabled on every
        platform rather than just web: an animation is a nicety, a permanently
        invisible validation error is a defect, and native cannot be verified
        from here. Worth revisiting when there is a device to test on.
      */}
      {errors?.length ? (
        <FieldError isInvalid animation={false}>
          {errors[0]}
        </FieldError>
      ) : null}
    </TextField>
  );
}
