import * as React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing } from "@/theme/tokens";

type Props = {
  children: React.ReactNode;
  /** Names the region in the message, so a caught crash says where. */
  label?: string;
};

type State = {
  error: Error | null;
};

/**
 * Catches errors thrown while rendering its subtree and shows a
 * readable panel in their place. installErrorAlert covers uncaught
 * errors outside render; this covers a screen that throws mid-render,
 * where React would otherwise unmount the whole tree and leave a
 * blank app.
 *
 * Retry clears the caught error and renders the children again. A
 * deterministic crash throws again and the panel returns, which is
 * the honest result.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Keep the report in the console too: the panel is for the user,
    // the console is for whoever reads the crash next.
    console.error(
      this.props.label ? `Render error in ${this.props.label}` : "Render error",
      error,
      info.componentStack,
    );
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (error == null) {
      return this.props.children;
    }
    const title = this.props.label
      ? `${this.props.label} hit a problem`
      : "Something broke";
    return (
      <View style={styles.root}>
        <View style={styles.panel}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message} selectable>
            {error.message || String(error)}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={this.retry}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
    padding: spacing.xl,
  },
  panel: {
    width: "100%",
    maxWidth: 480,
    gap: spacing.m,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius,
    padding: spacing.xl,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: fonts.body,
    fontWeight: "600",
    color: colors.ink,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  button: {
    alignSelf: "flex-start",
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.l,
    borderRadius: radius,
    backgroundColor: colors.accent,
  },
  buttonPressed: {
    backgroundColor: colors.accentDeep,
  },
  buttonText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.body,
    fontWeight: "600",
    color: colors.onAccent,
  },
});
