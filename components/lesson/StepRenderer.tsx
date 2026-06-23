"use client"
import type { Step } from "@/lib/types"
import { ConceptCard } from "./ConceptCard"
import { PuzzleStep } from "./PuzzleStep"
import { ContinuationStep } from "./ContinuationStep"
import { PlayVsBotStep } from "./PlayVsBotStep"
import { MultipleChoiceStep } from "./MultipleChoiceStep"
import { IdentifyStep } from "./IdentifyStep"

interface Props {
  step: Step
  onStepComplete: (isCorrect: boolean) => void
  isLastStep: boolean
}

export function StepRenderer({ step, onStepComplete, isLastStep }: Props) {
  switch (step.type) {
    case "concept":
      return <ConceptCard step={step} onContinue={() => onStepComplete(true)} />
    case "puzzle":
      return <PuzzleStep step={step} onComplete={onStepComplete} isLastStep={isLastStep} />
    case "continuation":
      return <ContinuationStep step={step} onComplete={onStepComplete} isLastStep={isLastStep} />
    case "play-vs-bot":
      return <PlayVsBotStep step={step} onComplete={onStepComplete} isLastStep={isLastStep} />
    case "multiple-choice":
      return <MultipleChoiceStep step={step} onComplete={onStepComplete} isLastStep={isLastStep} />
    case "identify":
      return <IdentifyStep step={step} onComplete={onStepComplete} isLastStep={isLastStep} />
    default:
      return <div className="text-gray-400 text-center py-10">Step type not yet implemented.</div>
  }
}
