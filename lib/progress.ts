import type { Course, Chapter, Lesson } from "./types"

// Returns the first lesson ID in a course that the user has NOT completed.
export function getNextLesson(course: Course, completedLessonIds: string[]): Lesson | null {
  for (const chapter of course.chapters) {
    for (const lesson of chapter.lessons) {
      if (!completedLessonIds.includes(lesson.id)) return lesson
    }
  }
  return null
}

// Returns true if the given lesson is unlocked for this user.
// Rule: a lesson is unlocked if all lessons before it (in chapter order) are complete.
export function isLessonUnlocked(
  course: Course,
  lessonId: string,
  completedLessonIds: string[]
): boolean {
  for (const chapter of course.chapters) {
    for (let i = 0; i < chapter.lessons.length; i++) {
      const lesson = chapter.lessons[i]
      if (lesson.id === lessonId) {
        // First lesson in the course is always unlocked
        if (i === 0 && chapter === course.chapters[0]) return true
        // Otherwise, the previous lesson must be complete
        if (i > 0) return completedLessonIds.includes(chapter.lessons[i - 1].id)
        // First lesson of a later chapter: previous chapter's last lesson must be complete
        const chapterIndex = course.chapters.indexOf(chapter)
        const prevChapter = course.chapters[chapterIndex - 1]
        const lastLessonOfPrevChapter = prevChapter.lessons[prevChapter.lessons.length - 1]
        return completedLessonIds.includes(lastLessonOfPrevChapter.id)
      }
    }
  }
  return false
}

// Calculates course completion percentage (0–100).
export function getCourseProgress(course: Course, completedLessonIds: string[]): number {
  const total = course.chapters.reduce((sum, ch) => sum + ch.lessons.length, 0)
  if (total === 0) return 0
  const done = completedLessonIds.filter(id =>
    course.chapters.some(ch => ch.lessons.some(l => l.id === id))
  ).length
  return Math.round((done / total) * 100)
}

// Returns today's date as a YYYY-MM-DD string (local time).
export function todayString(): string {
  return new Date().toISOString().split("T")[0]
}

// Given the stored last_activity_date and current_streak, returns the new streak.
export function calculateStreak(lastActivityDate: string | null, currentStreak: number): number {
  if (!lastActivityDate) return 1
  const today = todayString()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split("T")[0]
  if (lastActivityDate === today) return currentStreak           // already logged today
  if (lastActivityDate === yesterdayStr) return currentStreak + 1 // continuing streak
  return 1                                                         // streak broken
}

// Finds a lesson by ID across all chapters of a course.
export function findLesson(course: Course, lessonId: string): Lesson | null {
  for (const chapter of course.chapters) {
    for (const lesson of chapter.lessons) {
      if (lesson.id === lessonId) return lesson
    }
  }
  return null
}

// Finds which chapter a lesson belongs to.
export function findChapterForLesson(course: Course, lessonId: string): Chapter | null {
  for (const chapter of course.chapters) {
    if (chapter.lessons.some(l => l.id === lessonId)) return chapter
  }
  return null
}
