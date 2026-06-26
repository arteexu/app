import type { Course, Chapter, Lesson } from "./types"
import { getChapterLessons } from "./courses"

// Returns the first lesson ID in a course that the user has NOT completed.
export function getNextLesson(course: Course, completedLessonIds: string[]): Lesson | null {
  for (const chapter of course.chapters) {
    for (const lesson of getChapterLessons(chapter)) {
      if (!completedLessonIds.includes(lesson.id)) return lesson
    }
  }
  return null
}

// Returns true if the given lesson is unlocked for this user.
// All lessons are always accessible — learners can work at their own pace and skip around.
// Completion status is still tracked (for display and XP), but nothing is gated.
export function isLessonUnlocked(
  _course: Course,
  _lessonId: string,
  _completedLessonIds: string[]
): boolean {
  return true
  // Legacy sequential logic kept below for reference:
  for (const chapter of _course.chapters) {
    for (let i = 0; i < chapter.lessons.length; i++) {
      const lesson = chapter.lessons[i]
      if (lesson.id === _lessonId) {
        if (i === 0 && chapter === _course.chapters[0]) return true
        if (i > 0) return _completedLessonIds.includes(chapter.lessons[i - 1].id)
        const chapterIndex = _course.chapters.indexOf(chapter)
        const prevChapter = _course.chapters[chapterIndex - 1]
        const lastLessonOfPrevChapter = prevChapter.lessons[prevChapter.lessons.length - 1]
        return _completedLessonIds.includes(lastLessonOfPrevChapter.id)
      }
    }
  }
  return false
}

// Counts completed lessons that belong to this course.
export function getCompletedLessonCount(course: Course, completedLessonIds: string[]): number {
  return completedLessonIds.filter(id =>
    course.chapters.some(ch => getChapterLessons(ch).some(l => l.id === id))
  ).length
}

// Calculates course completion percentage (0–100).
export function getCourseProgress(course: Course, completedLessonIds: string[]): number {
  const total = course.chapters.reduce((sum, ch) => sum + getChapterLessons(ch).length, 0)
  if (total === 0) return 0
  return Math.round((getCompletedLessonCount(course, completedLessonIds) / total) * 100)
}

// Returns a YYYY-MM-DD string in the user's LOCAL timezone.
// Never use toISOString() here — that returns UTC, which can be a different
// calendar date for users in timezones behind UTC (all of the Americas).
function localDate(d: Date = new Date()): string {
  const y   = d.getFullYear()
  const m   = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// Returns today's date as a YYYY-MM-DD string in LOCAL time.
export function todayString(): string {
  return localDate()
}

// Given the stored last_activity_date and current_streak, returns the new streak.
export function calculateStreak(lastActivityDate: string | null, currentStreak: number): number {
  if (!lastActivityDate) return 1
  const today     = localDate()
  const yest      = new Date()
  yest.setDate(yest.getDate() - 1)
  const yesterday = localDate(yest)
  if (lastActivityDate === today)     return currentStreak           // already logged today
  if (lastActivityDate === yesterday) return currentStreak + 1       // continuing streak
  return 1                                                            // streak broken
}

// Finds a lesson by ID across all chapters of a course.
export function findLesson(course: Course, lessonId: string): Lesson | null {
  for (const chapter of course.chapters) {
    for (const lesson of getChapterLessons(chapter)) {
      if (lesson.id === lessonId) return lesson
    }
  }
  return null
}

// Finds which chapter a lesson belongs to.
export function findChapterForLesson(course: Course, lessonId: string): Chapter | null {
  for (const chapter of course.chapters) {
    if (getChapterLessons(chapter).some(l => l.id === lessonId)) return chapter
  }
  return null
}
