import { normalizeText } from "./utils"

export type RoleKey = "admin" | "doctor" | "nurse" | "technician" | "accountant" | "other"

type RoleMatcher = {
  role: RoleKey
  keywords: string[]
}

const roleMatchers: RoleMatcher[] = [
  {
    role: "admin",
    keywords: [
      "admin",
      "administrator",
      "system admin",
      "system administrator",
      "quan tri",
      "quan tri vien",
      "superuser",
    ],
  },
  {
    role: "doctor",
    keywords: [
      "doctor",
      "physician",
      "medical doctor",
      "bac si",
      "bac sy",
      "bac si kham",
      "bac sy kham",
      "general practitioner",
      "specialist",
    ],
  },
  {
    role: "nurse",
    keywords: [
      "nurse",
      "registered nurse",
      "staff nurse",
      "dieu duong",
      "dieu duong vien",
      "reception nurse",
      "triage nurse",
      "receptionist",
    ],
  },
  {
    role: "technician",
    keywords: [
      "technician",
      "lab technician",
      "laboratory technician",
      "medical technologist",
      "technologist",
      "ky thuat vien",
      "ky thuat vien xet nghiem",
    ],
  },
  {
    role: "accountant",
    keywords: [
      "accountant",
      "finance",
      "financial",
      "billing",
      "cashier",
      "ke toan",
      "thu ngan",
    ],
  },
]

const normalizeRolePattern = (value: string): string => {
  if (!value) {
    return ""
  }

  return normalizeText(value).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
}

export const resolveRoleKey = (value: string | null | undefined): RoleKey => {
  const normalized = normalizeRolePattern(value ?? "")

  if (!normalized) {
    return "other"
  }

  for (const matcher of roleMatchers) {
    for (const keyword of matcher.keywords) {
      const normalizedKeyword = normalizeRolePattern(keyword)
      if (!normalizedKeyword) {
        continue
      }

      if (normalized === normalizedKeyword || normalized.includes(normalizedKeyword)) {
        return matcher.role
      }
    }
  }

  return "other"
}
