import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '@/features/auth/session';
import { DocumentsSection } from '@/features/DocumentsSection';
import { useMember } from '@/features/staff/members';
import { useNominees } from '@/features/staff/nominees';
import { usePreferenceOptions, usePreferences } from '@/features/staff/preferences';
import {
  Button,
  Divider,
  Field,
  Icon,
  Inline,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  Stack,
  StatusBadge,
  StateView,
  Text,
  type,
} from '@/ui';

/**
 * A member's record, to be READ.
 *
 * WHY THIS EXISTS BESIDE THE EDIT SCREEN. Clicking a member's name used to
 * open the form that changes them. That is the wrong default for the thing
 * people do most: an officer answering "what is this member's NID" or "who is
 * their nominee" wants to look, and was given twelve editable inputs and a
 * Save button instead. A screen that can alter the record by a mistyped
 * keystroke is not the one to land on from a list.
 *
 * EVERYTHING IN ONE PLACE, which the edit screen deliberately is not - it is
 * split the way the API is, because each part saves separately. Nothing saves
 * here, so the split has no job, and the questions people actually arrive with
 * cross those boundaries: the nominee's NID sits under a different permission
 * from the member's address and is read in the same breath.
 *
 * Editing is still a tap away for whoever may do it. The button says so
 * plainly rather than making the whole page an edit surface on the chance.
 */
export default function MemberProfileView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = Number(id);
  const { can } = useSession();

  const member = useMember(memberId);
  const nominees = useNominees(memberId);
  const preferences = usePreferences(memberId);
  const options = usePreferenceOptions();

  const detail = member.data;

  return (
    <Screen onRefresh={() => void member.refetch()} refreshing={member.isRefetching}>
      <ScreenHeader
        title={detail?.name ?? 'Member'}
        subtitle={detail?.membership_no ? `Membership ${detail.membership_no}` : 'No number yet'}
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Icon name="back" size={15} tone="muted" />
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      <StateView loading={member.isPending} error={member.error} onRetry={member.refetch}>
        {detail ? (
          <>
            <Section first>
              <Panel>
                <Inline gap="md" justify="between">
                  <Stack gap="xs">
                    <Text style={type.rowTitle}>{detail.name}</Text>
                    <Text tone="muted" style={type.rowMeta}>
                      {detail.mobile}
                      {detail.email ? ` · ${detail.email}` : ''}
                    </Text>
                  </Stack>

                  <StatusBadge status={detail.status} />
                </Inline>

                {can('members.edit') ? (
                  <>
                    <Divider />
                    <Inline gap="sm">
                      <Button
                        size="sm"
                        variant="secondary"
                        onPress={() => router.push(`/staff/members/${memberId}`)}
                      >
                        <Icon name="edit" size={14} tone="muted" />
                        <Button.Label>Edit details</Button.Label>
                      </Button>
                    </Inline>
                  </>
                ) : null}
              </Panel>
            </Section>

            <Section title="The society record">
              <Field label="Membership number" value={detail.membership_no ?? '—'} />
              <Field label="Joined the association" value={detail.join_date ?? '—'} />
              <Field label="Shares" value={String(detail.shares ?? 0)} />
              <Field label="Share certificate no." value={detail.share_no ?? '—'} />
              <Field label="Employer" value={detail.company ?? '—'} />
              <Field label="Designation" value={detail.designation ?? '—'} />
            </Section>

            <Section title="Personal">
              <Field label="Father's name" value={detail.father_name ?? '—'} />
              <Field label="Mother's name" value={detail.mother_name ?? '—'} />
              <Field label="Date of birth" value={detail.birth_date ?? '—'} />
              <Field label="Gender" value={detail.gender ?? '—'} />
              <Field label="NID number" value={detail.nid ?? '—'} />
              <Field label="Present address" value={detail.present_address ?? '—'} />
              <Field label="Permanent address" value={detail.permanent_address ?? '—'} />
            </Section>

            <Section title="Cadre service">
              <Field label="BCS batch" value={detail.bcs_batch ?? '—'} />
              <Field label="Joined the service" value={detail.joining_date ?? '—'} />
            </Section>

            {/*
              WHO BROUGHT THEM IN, and how many they have brought since. The
              second is the reason this is worth a line rather than a field:
              an association runs on introductions, and the count is the only
              place that is visible.
            */}
            <Section title="Introduced by">
              <Field
                label="Name"
                value={
                  detail.introduced_by?.name
                    ? detail.introduced_by.membership_no
                      ? `${detail.introduced_by.name} · ${detail.introduced_by.membership_no}`
                      : detail.introduced_by.name
                    : '—'
                }
              />
              <Field label="Members they have introduced" value={String(detail.introduced_count)} />
            </Section>

            {/*
              READ ONLY, unlike the same component on the edit screen. A
              document is how the association proves who somebody is, and
              replacing one is a decision, not something to reach by tapping a
              name in a list.
            */}
            <DocumentsSection
              owner={{ kind: 'member', id: memberId }}
              editable={false}
              title="Documents"
            />

            <Section title="Nominees">
              <StateView
                loading={nominees.isPending}
                error={nominees.error}
                empty={(nominees.data?.data ?? []).length === 0}
                emptyTitle="No nominee recorded"
                emptyMessage="This member has not named anybody the association would contact."
              >
                <Stack gap="lg">
                  {(nominees.data?.data ?? []).map((nominee, index) => (
                    <Stack key={nominee.id} gap="xs">
                      {index > 0 ? <Divider /> : null}

                      <Text style={type.rowTitle}>
                        {nominee.name}
                        {nominee.relation ? ` · ${nominee.relation}` : ''}
                      </Text>

                      <Field label="Father's name" value={nominee.father_name ?? '—'} />
                      <Field label="Mother's name" value={nominee.mother_name ?? '—'} />
                      <Field label="Date of birth" value={nominee.birth_date ?? '—'} />
                      <Field label="NID number" value={nominee.nid ?? '—'} />
                      <Field label="Mobile" value={nominee.mobile ?? '—'} />
                      <Field label="Address" value={nominee.address ?? '—'} />
                      <Field label="Profession" value={nominee.profession ?? '—'} />
                    </Stack>
                  ))}
                </Stack>
              </StateView>
            </Section>

            <Section title="What they are looking for">
              <StateView
                loading={preferences.isPending || options.isPending}
                error={preferences.error}
                empty={(preferences.data?.data ?? []).every((row) => !row.answered)}
                emptyTitle="No answer yet"
                emptyMessage="This member has not said what they are looking for."
              >
                <Stack gap="lg">
                  {(preferences.data?.data ?? [])
                    .filter((row) => row.answered)
                    .map((row) => (
                      <Stack key={row.project} gap="xs">
                        <Text style={type.rowTitle}>
                          {options.data?.projects[row.project] ?? row.project}
                        </Text>

                        <Field
                          label="Preferred areas"
                          value={(row.areas ?? []).join(', ') || '—'}
                        />
                        <Field
                          label="Flat size (sft)"
                          value={row.flat_size_sft ? String(row.flat_size_sft) : '—'}
                        />
                        <Field
                          label="Budget"
                          value={
                            row.budget ? (options.data?.budgets[row.budget] ?? row.budget) : '—'
                          }
                        />
                        <Field
                          label="Bank loan wanted"
                          value={
                            row.loan_percentage === null || row.loan_percentage === undefined
                              ? '—'
                              : row.loan_percentage === 0
                                ? 'None'
                                : `${row.loan_percentage}%`
                          }
                        />
                        <Field
                          label="Flats wanted"
                          value={row.flats_wanted ? String(row.flats_wanted) : '—'}
                        />
                        <Field label="Told about it by" value={row.introduced_by_name ?? '—'} />
                      </Stack>
                    ))}
                </Stack>
              </StateView>
            </Section>
          </>
        ) : null}
      </StateView>
    </Screen>
  );
}
