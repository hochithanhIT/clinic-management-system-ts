import { normalizeText } from "@/lib/utils"

export const DISPOSITION_VALUES = {
  discharge: "Discharge after examination",
  prescription: "Provide prescription and discharge",
  followUp: "Follow-up appointment",
} as const

export const DISPOSITION_OPTIONS = [
  { value: DISPOSITION_VALUES.discharge, label: "Discharge after examination" },
  { value: DISPOSITION_VALUES.prescription, label: "Provide prescription and discharge" },
  { value: DISPOSITION_VALUES.followUp, label: "Schedule follow-up appointment" },
] as const

export type DispositionOption = (typeof DISPOSITION_OPTIONS)[number]["value"]

const normalizeDispositionKey = (value: string): string => {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

const dispositionLookup = new Map<string, DispositionOption>()

const registerDisposition = (canonical: DispositionOption, aliases: string[]) => {
  const values = [canonical, ...aliases]
  for (const entry of values) {
    dispositionLookup.set(normalizeDispositionKey(entry), canonical)
  }
}

registerDisposition(DISPOSITION_VALUES.discharge, [
  "Discharge after exam",
  "kham xong cho ve",
])
registerDisposition(DISPOSITION_VALUES.prescription, [
  "Prescription and discharge",
  "cap toa cho ve",
])
registerDisposition(DISPOSITION_VALUES.followUp, [
  "hen kham",
  "Schedule follow-up appointment",
  "Follow up appointment",
])

export const normalizeDispositionValue = (
  value: string | null | undefined,
): string | null => {
  if (!value) {
    return null
  }

  const normalized = normalizeDispositionKey(value)
  return dispositionLookup.get(normalized) ?? value
}

export const isFollowUpDisposition = (value: string | null | undefined): boolean => {
  return normalizeDispositionValue(value) === DISPOSITION_VALUES.followUp
}

export const FOLLOW_UP_DISPOSITION_VALUE = DISPOSITION_VALUES.followUp
