import { router } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { ApiError } from '@/api/errors';
import {
  fileSize,
  useDecideDocument,
  useDocumentReviews,
  useReviewImage,
  type DocumentReview,
} from '@/features/documents';
import {
  Button,
  Divider,
  Form,
  FormActions,
  InputField,
  Panel,
  Screen,
  ScreenHeader,
  Section,
  StateView,
  Text,
  space,
  type,
} from '@/ui';

/**
 * Identity documents members have sent in (FR-MEM-8, parity P-10).
 *
 * THE IMAGE IS THE DECISION. Unlike the profile-update queue beside this one -
 * where the question is whether a new mobile number is plausible - there is
 * nothing to read here. An officer approves or refuses on whether the
 * photograph is legible and is of the right thing, so the picture is loaded
 * with the row rather than hidden behind a tap.
 *
 * A REFUSAL NEEDS A REASON, and the form makes that unavoidable. "Not accepted"
 * on its own leaves a member unable to tell whether to photograph it again,
 * send something else, or come to the office - so they send the same blurred
 * image a second time and everybody's day is worse.
 */
export default function DocumentReviewsScreen() {
  const reviews = useDocumentReviews();
  const [error, setError] = useState<string | null>(null);

  const waiting = reviews.data ?? [];

  return (
    <Screen
      width="reading"
      onRefresh={() => void reviews.refetch()}
      refreshing={reviews.isRefetching}
    >
      <ScreenHeader
        title="Document reviews"
        subtitle={waiting.length > 0 ? `${waiting.length} waiting` : undefined}
        action={
          <Button size="sm" variant="tertiary" onPress={() => router.back()}>
            <Button.Label>Back</Button.Label>
          </Button>
        }
      />

      {error ? (
        <View style={{ marginTop: space.lg }}>
          <Panel tone="danger">
            <Text style={type.body}>{error}</Text>
          </Panel>
        </View>
      ) : null}

      <Section title="Waiting" first={!error}>
        <StateView
          loading={reviews.isLoading}
          error={reviews.error}
          empty={waiting.length === 0}
          emptyTitle="Nothing waiting"
          emptyMessage="No member has sent a document for review."
          onRetry={() => void reviews.refetch()}
        >
          {waiting.map((review, index) => (
            <ReviewCard
              key={review.id}
              review={review}
              divider={index < waiting.length - 1}
              onError={setError}
            />
          ))}
        </StateView>
      </Section>
    </Screen>
  );
}

function ReviewCard({
  review,
  divider,
  onError,
}: {
  review: DocumentReview;
  divider: boolean;
  onError: (message: string | null) => void;
}) {
  const decide = useDecideDocument();
  const image = useReviewImage(review.id, true);

  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState('');

  const submit = async (decision: 'approved' | 'rejected') => {
    onError(null);

    try {
      await decide.mutateAsync({
        id: review.id,
        decision,
        reason: decision === 'rejected' ? reason.trim() : undefined,
      });

      setRefusing(false);
      setReason('');
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'That decision could not be recorded.');
    }
  };

  return (
    <View style={{ marginBottom: space.lg }}>
      <Text style={type.rowTitle}>
        {review.owner_name ?? 'Unknown'} · {review.label}
      </Text>

      <Text tone="muted" style={type.rowMeta}>
        {[
          // Whose it is matters: a nominee's NID is judged differently from the
          // member's own, and the officer cannot tell from the picture.
          review.owner_type === 'nominee' ? 'Nominee' : 'Member',
          review.original_name,
          fileSize(review.size),
          review.submitted_at ? `sent ${review.submitted_at.slice(0, 10)}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </Text>

      <View style={{ marginTop: space.sm }}>
        <StateView
          loading={image.isLoading}
          error={image.error}
          onRetry={() => void image.refetch()}
        >
          {image.data ? (
            <Image
              source={{ uri: image.data }}
              // `contain`: a cropped NID is a document with the number cut off,
              // which is the one thing it is being looked at for.
              resizeMode="contain"
              style={{ width: '100%', height: 260, borderRadius: 10 }}
              accessibilityLabel={`${review.owner_name} ${review.label}`}
            />
          ) : null}
        </StateView>
      </View>

      {refusing ? (
        <View style={{ marginTop: space.md }}>
          <Form dense>
            <InputField
              label="Why is it not accepted?"
              required
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. the number is not readable"
              hint="The member sees this, so it should tell them what to do next."
            />

            <FormActions>
              <Button variant="secondary" onPress={() => setRefusing(false)}>
                <Button.Label>Cancel</Button.Label>
              </Button>

              <Button
                variant="danger"
                isDisabled={reason.trim().length === 0 || decide.isPending}
                onPress={() => void submit('rejected')}
              >
                <Button.Label>
                  {decide.isPending ? 'Sending…' : 'Not accepted'}
                </Button.Label>
              </Button>
            </FormActions>
          </Form>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
          <Button isDisabled={decide.isPending} onPress={() => void submit('approved')}>
            <Button.Label>{decide.isPending ? 'Saving…' : 'Approve'}</Button.Label>
          </Button>

          <Button variant="secondary" isDisabled={decide.isPending} onPress={() => setRefusing(true)}>
            <Button.Label>Not accepted</Button.Label>
          </Button>
        </View>
      )}

      {divider ? (
        <View style={{ marginTop: space.lg }}>
          <Divider />
        </View>
      ) : null}
    </View>
  );
}
