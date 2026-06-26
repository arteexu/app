import { CourseIcon } from "@/components/ui/course-icons"
import { COURSE_PREVIEWS } from "@/lib/course-previews"
import { CoursePreviewCard } from "@/components/ui/CoursePreviewCard"

export default function ZZIcons() {
  return (
    <div style={{ background: "#f4f4f5", padding: 40 }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640, marginBottom: 48 }}>
      <CoursePreviewCard
        preview={COURSE_PREVIEWS[0]}
        chapterCount={6}
        lessonCount={24}
        totalMinutes={90}
        progress={0}
        completedCount={0}
      />
      <CoursePreviewCard
        preview={COURSE_PREVIEWS[1]}
        chapterCount={3}
        lessonCount={9}
        totalMinutes={45}
        progress={40}
        completedCount={4}
      />
    </div>
    <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
      {COURSE_PREVIEWS.map((p) => (
        <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 120,
              height: 120,
              borderRadius: 24,
              backgroundColor: `color-mix(in srgb, ${p.accent} 12%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${p.accent} 26%, transparent)`,
            }}
          >
            <CourseIcon name={p.icon} style={{ color: p.accent, width: 64, height: 64 }} />
          </span>
          <span
            style={{
              display: "grid",
              placeItems: "center",
              width: 76,
              height: 76,
              borderRadius: 18,
              backgroundColor: `color-mix(in srgb, ${p.accent} 12%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${p.accent} 26%, transparent)`,
            }}
          >
            <CourseIcon name={p.icon} style={{ color: p.accent, width: 40, height: 40 }} />
          </span>
          <strong>{p.displayLabel}</strong>
        </div>
      ))}
    </div>
    </div>
  )
}
