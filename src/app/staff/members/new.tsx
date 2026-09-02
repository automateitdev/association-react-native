import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ApiError } from '@/api/errors';
import { useCreateMember, type NewMemberFields } from '@/features/staff/members';
import {
  Button,
  Card,
  Chip,
  Description,
  Input,
  Label,
  Screen,
  Text,
  TextField,
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
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Button variant="tertiary" onPress={() => router.back()}>
          <Button.Label>Back</Button.Label>
        </Button>
        <Text style={{ fontSize: 20, fontWeight: '700', flex: 1 }}>Add member</Text>
      </View>

      <Card>
        <Card.Body style={{ gap: 6 }}>
          <Text style={{ fontWeight: '600' }}>They will not be active yet</Text>
          <Text>
            New members are created awaiting approval. Approve them on their page once the
            association has agreed to admit them — they cannot sign in until you do.
          </Text>
        </Card.Body>
      </Card>

      {create.isError && Object.keys(fieldErrors).length === 0 ? (
        <Card>
          <Card.Body>
            <Text>
              {create.error instanceof ApiError
                ? create.error.message
                : 'The member could not be created.'}
            </Text>
          </Card.Body>
        </Card>
      ) : null}

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

      <View style={{ gap: 8 }}>
        <Text style={{ fontWeight: '600' }}>Gender</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['male', 'female', 'other'] as const).map((option) => (
            <Pressable key={option} onPress={() => set('gender')(option)}>
              <Chip variant={fields.gender === option ? 'primary' : 'secondary'}>
                <Chip.Label>{option}</Chip.Label>
              </Chip>
            </Pressable>
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

      <Button isDisabled={!canSubmit || create.isPending} onPress={() => void submit()}>
        <Button.Label>{create.isPending ? 'Creating…' : 'Create member'}</Button.Label>
      </Button>
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
    <TextField isInvalid={Boolean(errors?.length)}>
      <Label>
        {label}
        {required ? ' *' : ''}
      </Label>
      <Input
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={hint}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
      {errors?.length ? <Description>{errors[0]}</Description> : null}
    </TextField>
  );
}
