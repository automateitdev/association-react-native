import React from 'react';
import { View } from 'react-native';
import { Description, FieldError, Input, Label, TextField } from 'heroui-native';
import { space } from './tokens';

/**
 * The chrome every form field wears: a label, the control, and either a hint or
 * an error beneath it.
 *
 * WHY THIS EXISTS
 * ---------------
 * Four screens had four answers. `members/new` kept a private `Field` built on
 * HeroUI's TextField, so its labels got the library's Label typography and its
 * errors got FieldError. `admin/users` and `admin/roles` hand-rolled
 * `<Text style={{ ...type.rowMeta, marginBottom: 4 }}>` above a bare TextField.
 * `PickerField` did the same by hand again. `sign-in` used TextField directly.
 *
 * The result was visible rather than theoretical: on the staff account form the
 * text fields and the Role picker sat one above the other with DIFFERENT label
 * typography, because one came from HeroUI's Label and the other from a Text
 * with rowMeta. Nobody chose that; it is just what four implementations drift
 * into.
 *
 * So the chrome lives here once and the control is a child. A text input is
 * `InputField`, a dropdown is `PickerField` (ui/Picker), and both look the same
 * because they are the same component wearing a different middle.
 *
 * HINT AND ERROR ARE DIFFERENT SLOTS, deliberately. `Description` is helper
 * text; `FieldError` is what went wrong. Using the first for a validation
 * message says "here is a hint" in the place the reader is looking for "here is
 * what went wrong".
 */
/**
 * How tall the controls in this form are.
 *
 * DENSITY BELONGS TO THE FORM, not to each field - the same reasoning as the
 * gap below. A settings screen is eleven fields read on a desktop by staff; a
 * payment screen is three fields tapped one-handed on a phone. HeroUI's default
 * 48pt control is right for the second and a wall for the first, and asking
 * eleven call sites to each remember `dense` is how one of them gets forgotten
 * and sits a third taller than its neighbours.
 *
 * There is no size prop on the library's Input - customisation is className -
 * so this is the one place that knows the class.
 */
const FormDensity = React.createContext(false);

/** 40, against HeroUI's 48. Below about this a 16pt value starts to feel cramped. */
const DENSE_HEIGHT = 40;

export function FormField({
  label,
  required = false,
  hint,
  error,
  children,
}: {
  label: string;
  /** Draws HeroUI's own required marker - do not append an asterisk to the label. */
  required?: boolean;
  /** Helper text, shown only while there is no error to show instead. */
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    /*
      isInvalid propagates through TextField's form-item-state context, so
      Label, Input and FieldError all pick up the invalid styling without being
      told individually.
    */
    <TextField isRequired={required} isInvalid={Boolean(error)}>
      <Label>{label}</Label>

      {children}

      {error ? (
        /*
          TWO NON-OBVIOUS PROPS, BOTH LOAD-BEARING.

          `isInvalid` explicitly, rather than relying on the ambient form-item
          context: FieldError renders null unless it believes the field is
          invalid, and not depending on ambient state is the safer call for the
          one component whose whole job is to appear when something is wrong.

          `animation={false}` because the default entering animation leaves the
          element at `visibility: hidden` on React Native Web and never reveals
          it. The message was in the DOM, 20pt tall, full opacity, and
          completely invisible - after the 422 had already arrived. Disabled on
          every platform rather than just web: an animation is a nicety, a
          permanently invisible validation error is a defect, and native cannot
          be verified from here. Worth revisiting when there is a device to
          test on.
        */
        <FieldError isInvalid animation={false}>
          {error}
        </FieldError>
      ) : hint ? (
        <Description>{hint}</Description>
      ) : null}
    </TextField>
  );
}

/** A labelled text input. The common case, so it gets the short name. */
export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  required = false,
  hint,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'phone-pad' | 'email-address';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  required?: boolean;
  hint?: string;
  error?: string;
}) {
  const dense = React.useContext(FormDensity);

  return (
    <FormField label={label} required={required} hint={hint} error={error}>
      <Input
        /*
          `minHeight`, and that is the whole trick.
          
          HeroUI's input.css sets `min-height: calc(var(--spacing) * 12)` - 48pt
          - so neither nativewind's `h-10` nor an inline `height` can shorten it:
          a min-height beats both no matter who wins specificity. Overriding the
          property that is actually set is the only thing that works, and it
          took reading the library's stylesheet to see it.
        */
        style={dense ? { minHeight: DENSE_HEIGHT, height: DENSE_HEIGHT } : undefined}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        // An email or a mobile number that arrives capitalised is a support
        // call, so the keyboard type settles it unless told otherwise.
        autoCapitalize={autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')}
      />
    </FormField>
  );
}

/**
 * A vertical stack of fields with one consistent gap between them.
 *
 * The gap belongs to the form, not to the fields. Screens used to space their
 * own fields, so `fees/new` wrapped every picker after the first in a
 * `<View style={{ marginTop: space.md }}>` while `members/new` relied on a
 * container gap - two spacings, and a field that could not be reordered
 * without carrying its margin with it.
 *
 * `maxWidth` because a text input stretched across a desktop window is harder
 * to read, not easier: the eye loses the line. Forms cap; tables do not.
 */
export function Form({
  children,
  maxWidth = 460,
  gap = space.md,
  dense = false,
}: {
  children: React.ReactNode;
  maxWidth?: number | null;
  gap?: number;
  /** Shorter controls, for admin forms read on a desktop. See FormDensity. */
  dense?: boolean;
}) {
  return (
    <FormDensity.Provider value={dense}>
      <View style={{ gap, ...(maxWidth === null ? {} : { maxWidth }) }}>{children}</View>
    </FormDensity.Provider>
  );
}

/**
 * Fields side by side, wrapping when there is no room.
 *
 * A fine rate, a grace period and a suspension threshold are all two or three
 * characters wide, and giving each its own full-width line turns three small
 * numbers into a column of large boxes. That is most of why a settings screen
 * reads as heavy: not the height of any one field, but how many lines it takes
 * to ask for very little.
 *
 * `minWidth` rather than a column count, so the same markup is two-up on a
 * desktop and stacked on a phone with nothing to configure.
 */
export function FormRow({ children, minWidth = 150 }: { children: React.ReactNode; minWidth?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {React.Children.map(children, (child) => (
        <View style={{ flexGrow: 1, flexBasis: minWidth, minWidth }}>{child}</View>
      ))}
    </View>
  );
}

/**
 * The row of buttons that ends a form.
 *
 * Separated from the fields by more than the field gap, so the last field and
 * the submit button do not read as a pair.
 */
export function FormActions({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>{children}</View>
  );
}
