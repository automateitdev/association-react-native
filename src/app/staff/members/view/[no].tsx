import { router, useLocalSearchParams } from 'expo-router';
import { Image, View } from 'react-native';
import { useSession } from '@/features/auth/session';
import { DocumentsSection } from '@/features/DocumentsSection';
import { useDocumentImage, useDocuments } from '@/features/documents';
import { useMemberByNumber, type MemberDetail } from '@/features/staff/members';
import { useNominees, type Nominee } from '@/features/staff/nominees';
import { usePreferenceOptions, usePreferences } from '@/features/staff/preferences';
import {
  Button,
  Divider,
  Icon,
  Inline,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  Stack,
  StateView,
  StatusBadge,
  Text,
  space,
  type,
} from '@/ui';

/**
 * A member's record, to be READ.
 *
 * WHY THIS EXISTS BESIDE THE EDIT SCREEN. Clicking a member's name used to
 * open the form that changes them, which is the wrong default for the thing
 * people do most: an officer answering "what is this member's NID" or "who is
 * their nominee" wants to look, and was given twelve editable inputs and a
 * Save button. A screen that can alter the record with a mistyped keystroke is
 * not the one to land on from a list.
 *
 * AND IT HAS TO LOOK LIKE A PERSON, which the first version did not. It was
 * forty label-and-value rows in a single column - every fact given identical
 * weight, no face, nothing to catch the eye of somebody who opened it to check
 * one thing. A record about a human being that reads like a database dump
 * makes the reader do the sorting the screen should have done.
 *
 * So: the identity card first, then the figures an officer is usually
 * checking, then the facts in pairs under headings, then the people and the
 * plans. The PHOTOGRAPH is the largest of those changes - an office
 * identifies members by face at a counter, the association already holds one,
 * and the screen was not showing it.
 */
export default function MemberProfileView() {
  /*
   * THE MEMBERSHIP NUMBER, not the row id. "/staff/members/view/31" is a
   * database counter in an address somebody may paste into an email; 125 is
   * what the office says out loud.
   *
   * The id is still what everything underneath uses, so it is read FROM THE
   * RECORD once the number has found one rather than carried in the URL beside
   * it. Two identifiers in one address is how they come to disagree.
   */
  const { no } = useLocalSearchParams<{ no: string }>();
  const { can } = useSession();

  const member = useMemberByNumber(String(no ?? ''));
  const detail = member.data;
  const memberId = detail?.id ?? 0;

  /*
   * Held until the number resolves. `enabled` rather than a guard around the
   * render, because a query keyed on id 0 would be cached under that key and
   * answer the next member's screen from it.
   */
  const ready = memberId > 0;
  const nominees = useNominees(memberId, ready);
  const preferences = usePreferences(memberId, ready);
  const options = usePreferenceOptions();

  const answered = (preferences.data?.data ?? []).filter((row) => row.answered);

  return (
    <Screen onRefresh={() => void member.refetch()} refreshing={member.isRefetching}>
      <ScreenHeader
        title={detail?.name ?? 'Member'}
        subtitle={`Membership ${no}`}
        action={
          <Inline gap="sm">
            {can('members.edit') && ready ? (
              <Button
                size="sm"
                variant="secondary"
                onPress={() => router.push(`/staff/members/${memberId}`)}
              >
                <Icon name="edit" size={15} tone="muted" />
                <Button.Label>Edit</Button.Label>
              </Button>
            ) : null}

            <Button size="sm" variant="tertiary" onPress={() => router.back()}>
              <Icon name="back" size={15} tone="muted" />
              <Button.Label>Back</Button.Label>
            </Button>
          </Inline>
        }
      />

      <StateView loading={member.isPending} error={member.error} onRetry={member.refetch}>
        {detail ? (
          <>
            <IdentityCard member={detail} />

            {/*
              WHAT AN OFFICER IS USUALLY CHECKING, across the top rather than
              buried in a list of forty identical rows. These four answer the
              questions people arrive with; everything below answers the ones
              they arrive with occasionally.
            */}
            <Section first>
              <Inline gap="sm" wrap>
                <Figure label="Shares" value={String(detail.shares ?? 0)} />
                <Figure label="Nominees" value={String((nominees.data?.data ?? []).length)} />
                <Figure label="Projects answered" value={`${answered.length} of 3`} />
                <Figure label="Members introduced" value={String(detail.introduced_count)} />
              </Inline>
            </Section>

            <Section title="The society record">
              <Pairs
                rows={[
                  ['Membership number', detail.membership_no],
                  ['Joined the association', detail.join_date],
                  ['Share certificate no.', detail.share_no],
                  ['Employer', detail.company],
                  ['Designation', detail.designation],
                  ['BCS batch', detail.bcs_batch],
                  ['Joined the service', detail.joining_date],
                ]}
              />
            </Section>

            <Section title="Personal">
              <Pairs
                rows={[
                  ["Father's name", detail.father_name],
                  ["Mother's name", detail.mother_name],
                  ['Date of birth', detail.birth_date],
                  ['Gender', detail.gender],
                  ['NID number', detail.nid],
                ]}
              />

              <Stack gap="md">
                <Line label="Present address" value={detail.present_address} />
                <Line label="Permanent address" value={detail.permanent_address} />
              </Stack>
            </Section>

            <Section title="Introduced by">
              {detail.introduced_by?.name ? (
                <Pairs
                  rows={[
                    ['Name', detail.introduced_by.name],
                    ['Their membership number', detail.introduced_by.membership_no],
                  ]}
                />
              ) : (
                <Text tone="muted" style={type.body}>
                  Nobody is recorded as having introduced this member.
                </Text>
              )}
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
                <Stack gap="md">
                  {(nominees.data?.data ?? []).map((nominee) => (
                    <NomineeCard key={nominee.id} nominee={nominee} />
                  ))}
                </Stack>
              </StateView>
            </Section>

            <Section title="What they are looking for">
              <StateView
                loading={preferences.isPending || options.isPending}
                error={preferences.error}
                empty={answered.length === 0}
                emptyTitle="No answer yet"
                emptyMessage="This member has not said what they are looking for."
              >
                <Stack gap="md">
                  {answered.map((row) => (
                    <Panel key={row.project}>
                      <Text style={type.rowTitle}>
                        {options.data?.projects[row.project] ?? row.project}
                      </Text>

                      {(row.areas ?? []).length > 0 ? (
                        <Text tone="muted" style={type.body}>
                          {(row.areas ?? []).join(' · ')}
                        </Text>
                      ) : null}

                      <Divider />

                      <Pairs
                        rows={[
                          [
                            'Budget',
                            row.budget ? (options.data?.budgets[row.budget] ?? row.budget) : null,
                          ],
                          ['Flat size', row.flat_size_sft ? `${row.flat_size_sft} sft` : null],
                          [
                            'Bank loan',
                            row.loan_percentage === null || row.loan_percentage === undefined
                              ? null
                              : row.loan_percentage === 0
                                ? 'None'
                                : `${row.loan_percentage}%`,
                          ],
                          ['Flats wanted', row.flats_wanted ? String(row.flats_wanted) : null],
                          ['Told about it by', row.introduced_by_name],
                        ]}
                      />
                    </Panel>
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

/**
 * Who this is, at a glance.
 *
 * THE PHOTOGRAPH IS THE POINT. An office identifies a member by face at a
 * counter, the association already holds one, and this screen was not showing
 * it - so an officer checking whether the person in front of them is member
 * 125 had to open the Documents section and expand a slot.
 *
 * Initials when there is none, never an empty grey box: a blank reads as a
 * picture that failed to load rather than one nobody has sent.
 */
function IdentityCard({ member }: { member: MemberDetail }) {
  /*
   * Shares a query key with the Documents section below, so the photograph
   * costs no extra request - and it is fetched only once the slot list says
   * the slot is filled, rather than firing a request that 404s for every
   * member who has not sent one.
   */
  const documents = useDocuments({ kind: 'member', id: member.id });
  const hasPhoto = (documents.data ?? []).some((slot) => slot.slot === 'image' && slot.uploaded);
  const photo = useDocumentImage({ kind: 'member', id: member.id }, 'image', hasPhoto);

  const initials = member.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View
      className="bg-surface border border-border"
      style={{ borderRadius: 16, overflow: 'hidden', marginTop: space.lg }}
    >
      <View style={{ flexDirection: 'row', gap: space.lg, padding: space.lg }}>
        <View
          className="bg-background-secondary border border-border"
          style={{
            width: 84,
            height: 100,
            borderRadius: 10,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {photo.data ? (
            <Image
              source={{ uri: photo.data }}
              resizeMode="cover"
              style={{ width: '100%', height: '100%' }}
              accessibilityLabel={`Photograph of ${member.name}`}
            />
          ) : (
            <Text tone="muted" style={{ ...type.rowTitle, fontSize: 24 }}>
              {initials || '—'}
            </Text>
          )}
        </View>

        <Stack gap="xs" grow>
          <Text style={{ ...type.rowTitle, fontSize: 19 }} numberOfLines={2}>
            {member.name}
          </Text>

          {/*
            The number an officer asks for, second-loudest and not buried in
            the fields below.
          */}
          <Text tone="muted" style={type.rowMeta}>
            {member.membership_no ? `Member no. ${member.membership_no}` : 'No number yet'}
          </Text>

          <Text tone="muted" style={type.rowMeta}>
            {member.mobile}
            {member.email ? ` · ${member.email}` : ''}
          </Text>
        </Stack>

        <StatusBadge status={member.status} />
      </View>
    </View>
  );
}

/** One figure worth reading before any of the detail. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View
      className="bg-surface border border-border"
      style={{ flex: 1, minWidth: 130, padding: space.md, borderRadius: 12, gap: 2 }}
    >
      <Text tone="muted" style={type.section}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ ...type.rowTitle, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

/**
 * Short facts, two to a row.
 *
 * WHY NOT `Field`, which this screen used throughout. Field is a full-width
 * label-left / value-right row, and forty of them in one column is the
 * database dump this screen was. These are short values - a date, a batch, a
 * number - so pairing them halves the scroll.
 *
 * EVERY ROW STAYS, including the empty ones. An officer needs to see what the
 * association is MISSING as much as what it holds, so a blank is a dash rather
 * than a hidden row - the alternative is a screen that looks complete because
 * it quietly dropped what is not there.
 */
function Pairs({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <Inline gap="none" wrap>
      {rows.map(([label, value]) => (
        <View key={label} style={{ width: '50%', minWidth: 150, paddingVertical: space.sm }}>
          <Text tone="muted" style={type.section}>
            {label.toUpperCase()}
          </Text>
          <Text style={type.body}>{value || '—'}</Text>
        </View>
      ))}
    </Inline>
  );
}

/** A long value that needs the whole width - an address, mostly. */
function Line({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View>
      <Text tone="muted" style={type.section}>
        {label.toUpperCase()}
      </Text>
      <Text style={type.body}>{value || '—'}</Text>
    </View>
  );
}

/**
 * A nominee, as a person rather than seven more rows.
 *
 * Their name leads and the relation sits beside it, because "Wife" is what
 * makes the rest of it mean anything. The identifying fields follow in pairs,
 * like the member's own.
 */
function NomineeCard({ nominee }: { nominee: Nominee }) {
  return (
    <Panel>
      <Inline gap="sm" align="center">
        <Icon name="profile" size={16} tone="muted" />
        <Text style={{ ...type.rowTitle, flex: 1 }}>{nominee.name}</Text>
        {nominee.relation ? (
          <Text tone="muted" style={type.rowMeta}>
            {nominee.relation}
          </Text>
        ) : null}
      </Inline>

      <Divider />

      <Pairs
        rows={[
          ["Father's name", nominee.father_name],
          ["Mother's name", nominee.mother_name],
          ['Date of birth', nominee.birth_date],
          ['NID number', nominee.nid],
          ['Mobile', nominee.mobile],
          ['Profession', nominee.profession],
        ]}
      />

      <Line label="Address" value={nominee.address} />
    </Panel>
  );
}
