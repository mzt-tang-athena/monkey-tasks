import { Pressable, View } from "react-native";
import type { TaskForm } from "../../../lib/settings";
import { styles } from "./plannerStyles";

/**
 * The tiny segmented form toggle at the bottom half's right edge:
 * rows (ticked list) or pills (drag-first chips). Presentation only;
 * the data is the same either way.
 */
export function FormToggle({
  form,
  onChange,
}: {
  form: TaskForm;
  onChange: (form: TaskForm) => void;
}) {
  return (
    <View style={styles.formToggle}>
      {(
        [
          { key: "rows", label: "list form" },
          { key: "pills", label: "pill form" },
        ] as const
      ).map((segment, index) => (
        <Pressable
          key={segment.key}
          style={({ pressed }) => [
            styles.formSegment,
            form === segment.key && styles.formSegmentActive,
            pressed && form !== segment.key && styles.formSegmentPressed,
            form === segment.key &&
              (index === 0 ? styles.segmentFirst : styles.segmentLast),
          ]}
          onPress={() => onChange(segment.key)}
          accessibilityRole="tab"
          accessibilityLabel={segment.label}
          accessibilityState={{ selected: form === segment.key }}
        >
          {segment.key === "rows" ? (
            <View style={styles.formGlyphRows}>
              <View
                style={[
                  styles.formGlyphBar,
                  form === segment.key && styles.formGlyphBarActive,
                ]}
              />
              <View
                style={[
                  styles.formGlyphBar,
                  styles.formGlyphBarShort,
                  form === segment.key && styles.formGlyphBarActive,
                ]}
              />
              <View
                style={[
                  styles.formGlyphBar,
                  form === segment.key && styles.formGlyphBarActive,
                ]}
              />
            </View>
          ) : (
            <View
              style={[
                styles.formGlyphPill,
                form === segment.key && styles.formGlyphPillActive,
              ]}
            />
          )}
        </Pressable>
      ))}
    </View>
  );
}
