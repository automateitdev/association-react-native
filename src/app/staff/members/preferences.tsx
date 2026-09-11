import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ApiError } from '@/api/errors';
import {
  usePreferenceOptions,
  usePreferences,
  useSavePreference,
  type Preference,
  type PreferenceOptions,
} from '@/features/staff/preferences';
import {
  Button,
  Form,
  FormActions,
  Icon,
  Inline,
  InputField,
  Panel,
  PickerField,
  Row,
  Screen,
  ScreenHeader,
  Section,
  Stack,
  StateView,
  Text,
  type,
} from '@/ui';

/**
 * What a member wants from the association's housing (legacy `member_choices`).
 *
 * THREE QUESTIONS, ALWAYS SHOWN. The projects are a fixed set, so all three
 * appear whether or not this member has answered any - an empty one is an
 * unanswered question, and a screen listing only the answers given could not
 * show the office what to ask next.
 *
 * A SMALL SCREEN ON PURPOSE. 18 of the association's 315 members ever answered
 * this in the legacy system. It is worth carrying and it is not worth a wizard;
 * the effort went into the shape of the data instead, where the legacy stored
 * "1,500 sft" and "1500 Sft" as different sizes and one column mixed `50%`
 * with `No` with `5000000`.
 *
 * A DISTRICT IS CHOSEN, AN AREA IS TYPED, and the two controls say so. There
 * are 64 districts and they do not change; the association's next site inside
 * Dhaka will be somewhere nobody has typed yet.
 */
export default function PreferencesScreen() {
  const params = useLocalSearchParams<{ member?: string }>();
  const memberId = Number(params.member);

  const preferences = usePreferences(memberId);
  const options = usePreferenceOptions();

  const [editing, setEditing] = useState<Preference | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = preferences.data?.data ?? [];
  const meta = preferences.data?.meta;

  return (
    <Screen width="reading">
      <ScreenHeader
        title="Housing preferences"
        subtitle={meta ? meta.member_name : undefined}
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <StateView
        loading={preferences.isLoading || options.isLoading}
        error={preferences.error ?? options.error}
        onRetry={() => void preferences.refetch()}
      >
        <Section first>
          <Panel>
            <Text tone="muted" style={type.rowMeta}>
              {meta?.answered === 0
                ? 'This member has not said what they are looking for.'
                : `Answered ${meta?.answered} of 3.`}{' '}
              Each project is asked separately, because a member can want different things in
              different places.
            </Text>
          </Panel>
        </Section>

        {error ? (
          <Section>
            <Panel tone="danger">
              <Text tone="danger" style={type.rowMeta}>
                {error}
              </Text>
            </Panel>
          </Section>
        ) : null}

        {list.map((preference) => (
          <Section key={preference.project} title={preference.project_label}>
            {editing?.project === preference.project && options.data ? (
              <PreferenceForm
                preference={preference}
                options={options.data}
                memberId={memberId}
                onDone={() => {
                  setEditing(null);
                  setError(null);
                }}
                onError={setError}
              />
            ) : (
              <Stack gap="sm">
                <Row
                  title={summarise(preference)}
                  meta={
                    preference.introduced_by_name
                      ? `Told about it by ${preference.introduced_by_name}`
                      : undefined
                  }
                  trailing={
                    <Button size="sm" variant="tertiary" onPress={() => setEditing(preference)}>
                      <Icon name="edit" size={15} tone="muted" />
                      <Button.Label>{preference.answered ? 'Edit' : 'Record'}</Button.Label>
                    </Button>
                  }
                  divider={false}
                />
              </Stack>
            )}
          </Section>
        ))}
      </StateView>
    </Screen>
  );
}

/**
 * One project's answer as a sentence.
 *
 * A SENTENCE RATHER THAN A GRID of mostly-empty fields: a member typically
 * answers two or three of the six, and six labelled blanks to find them in is
 * the layout that made the legacy form feel like a tax return.
 */
function summarise(preference: Preference): string {
  if (!preference.answered) return 'Not answered';

  const parts = [
    preference.areas.length > 0 ? preference.areas.join(', ') : null,
    preference.flat_size_sft ? `${preference.flat_size_sft} sft` : null,
    preference.budget_label,
    // 0 is an answer - "no loan" - and must not read as no answer at all.
    preference.loan_percentage === null ? null : `${preference.loan_percentage}% loan`,
    preference.flats_wanted
      ? `${preference.flats_wanted} flat${preference.flats_wanted === 1 ? '' : 's'}`
      : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' · ') : 'Answered';
}

function PreferenceForm({
  preference,
  options,
  memberId,
  onDone,
  onError,
}: {
  preference: Preference;
  options: PreferenceOptions;
  memberId: number;
  onDone: () => void;
  onError: (message: string | null) => void;
}) {
  const save = useSavePreference(memberId);

  const [areas, setAreas] = useState(preference.areas.join(', '));
  const [size, setSize] = useState(preference.flat_size_sft?.toString() ?? '');
  const [budget, setBudget] = useState(preference.budget ?? '');
  const [loan, setLoan] = useState(
    preference.loan_percentage === null ? '' : String(preference.loan_percentage),
  );
  const [flats, setFlats] = useState(preference.flats_wanted?.toString() ?? '');
  const [introducer, setIntroducer] = useState(
    preference.introduced_by_member_id === null ? (preference.introduced_by_name ?? '') : '',
  );

  const isDistrict = preference.project === 'other_district';

  /*
   * The districts, flattened for the picker but grouped in the label.
   *
   * The API groups them by division because that is how somebody scans for
   * their own; a single select cannot show groups, so the division rides along
   * in the option text rather than being lost.
   */
  const districtOptions = Object.entries(options.districts).flatMap(([division, names]) =>
    names.map((name) => ({ value: name, label: `${name} · ${division}` })),
  );

  return (
    <Form maxWidth={null} dense columns={2}>
      {isDistrict ? (
        /*
          ONE district, chosen. The legacy allowed several through the same JSON
          column it used for Dhaka areas, and in the production data nobody ever
          picked more than one - so this asks the question people answered.
        */
        <PickerField
          label="District"
          value={areas}
          options={[{ value: '', label: 'No district chosen' }, ...districtOptions]}
          onChange={setAreas}
        />
      ) : (
        <InputField
          label="Areas"
          value={areas}
          onChangeText={setAreas}
          // Typed, and separated by commas. A member who wants Uttara or
          // Mohammadpur is answering one question, not two.
          placeholder={options.dhaka_areas.slice(0, 3).join(', ')}
        />
      )}

      <InputField
        label="Flat size (sft)"
        value={size}
        onChangeText={setSize}
        keyboardType="decimal-pad"
        placeholder="1800"
      />

      <PickerField
        label="Budget"
        value={budget}
        options={[
          { value: '', label: 'Not said' },
          ...Object.entries(options.budgets).map(([value, label]) => ({ value, label })),
        ]}
        onChange={setBudget}
      />

      <PickerField
        label="Bank loan wanted"
        value={loan}
        options={[
          { value: '', label: 'Not said' },
          // 0 is "no loan" - an answer, and a different thing from silence.
          ...options.loan_percentages.map((percent) => ({
            value: String(percent),
            label: percent === 0 ? 'None' : `${percent}%`,
          })),
        ]}
        onChange={setLoan}
      />

      <InputField
        label="Flats wanted"
        value={flats}
        onChangeText={setFlats}
        keyboardType="decimal-pad"
        placeholder="1"
      />

      <InputField
        label="Told about it by"
        value={introducer}
        onChangeText={setIntroducer}
        placeholder="Name"
      />

      <FormActions>
        <Button
          variant="secondary"
          onPress={() => {
            onError(null);
            onDone();
          }}
        >
          <Button.Label>Cancel</Button.Label>
        </Button>

        <Button
          isDisabled={save.isPending}
          onPress={() => {
            onError(null);

            save.mutate(
              {
                project: preference.project,
                areas: areas.trim() === '' ? [] : areas.split(',').map((a) => a.trim()),
                flat_size_sft: size.trim() === '' ? null : Number(size),
                budget: budget === '' ? null : budget,
                loan_percentage: loan === '' ? null : Number(loan),
                flats_wanted: flats.trim() === '' ? null : Number(flats),

                /*
                 * The typed name only. Linking an introducer to their member
                 * record needs a member search, and that is the nominee-picker
                 * problem again rather than a text box - so the server keeps
                 * the name, and a later screen can resolve it the way the
                 * member's own referee was resolved.
                 */
                introduced_by_name: introducer.trim() === '' ? null : introducer.trim(),
              },
              {
                onSuccess: () => onDone(),
                onError: (e) =>
                  onError(e instanceof ApiError ? e.message : 'That could not be saved.'),
              },
            );
          }}
        >
          <Button.Label>{save.isPending ? 'Saving…' : 'Save'}</Button.Label>
        </Button>
      </FormActions>
    </Form>
  );
}
