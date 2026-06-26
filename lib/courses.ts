import attackAndCheckmate from "@/content/courses/chess-attack-and-checkmate.json"
import attackingChess from "@/content/courses/attacking-chess.json"
import type { Course, Chapter, Lesson } from "./types"

const COURSES: Course[] = [
  attackAndCheckmate as Course,
  attackingChess as Course,
]

export function getChapterLessons(chapter: Chapter): Lesson[] {
  const sectionLessons = chapter.sections?.flatMap((s) => s.lessons) ?? []
  return [...sectionLessons, ...chapter.lessons]
}

export function getCourseLessons(course: Course): Lesson[] {
  return course.chapters.flatMap(getChapterLessons)
}

export function getAllCourses(): Course[] {
  return COURSES
}

export function getCourse(id: string): Course | undefined {
  return COURSES.find((c) => c.id === id)
}

export function findLessonInCourses(
  lessonId: string,
): { course: Course; lesson: Lesson; chapter: Chapter } | null {
  for (const course of COURSES) {
    for (const chapter of course.chapters) {
      for (const lesson of getChapterLessons(chapter)) {
        if (lesson.id === lessonId) {
          return { course, lesson, chapter }
        }
      }
    }
  }
  return null
}
