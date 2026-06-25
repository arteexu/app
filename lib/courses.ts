import attackAndCheckmate from "@/content/courses/chess-attack-and-checkmate.json"
import attackingChess from "@/content/courses/attacking-chess.json"
import type { Course, Chapter, Lesson } from "./types"

const COURSES: Course[] = [
  attackAndCheckmate as Course,
  attackingChess as Course,
]

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
      for (const lesson of chapter.lessons) {
        if (lesson.id === lessonId) {
          return { course, lesson, chapter }
        }
      }
    }
  }
  return null
}
