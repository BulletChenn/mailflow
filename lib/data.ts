export type Email = {
  id: string
  from: string
  fromAddress?: string
  subject: string
  preview: string
  body: string
  receivedAt: string
  receivedDateTime?: string
  urgency: "High" | "Medium" | "Low"
  category: string
  originalLink: string
  tags: string[]
}

export const sampleEmails: Email[] = [
  {
    id: "1",
    from: "Mia Chen",
    fromAddress: "mia.chen@example.com",
    subject: "Quarterly Ops Review and launch timeline",
    preview:
      "Need your approval on the new launch timeline and cross-team deliverables.",
    body:
      "Hi, I need your alignment on the revised launch timeline and the updated deliverables for the Q3 release. The vendor timeline is tight, and the steering committee needs our sign-off by Friday. Can you confirm the final dates and own the stakeholder sync?",
    receivedAt: "2h ago",
    urgency: "High",
    category: "Stakeholder",
    originalLink: "/original/1",
    tags: ["Approval", "Timeline", "Stakeholder"],
  },
  {
    id: "2",
    from: "Javier Morales",
    fromAddress: "javier.morales@example.com",
    subject: "Feedback on the contract language",
    preview:
      "Please review the rental agreement wording before we sign. I translated the key points for you.",
    body:
      "Hola, revisé el lenguaje del contrato y marqué las secciones que necesitan cambios para que sean claras para la administración. Si necesitas, puedo enviar una versión en inglés corporativo que sea directa pero respetuosa. Estoy pendiente de tu confirmación.",
    receivedAt: "5h ago",
    urgency: "Medium",
    category: "Vendor",
    originalLink: "/original/2",
    tags: ["Translation", "Contract", "Landlord"],
  },
  {
    id: "3",
    from: "Priya Patel",
    fromAddress: "priya.patel@example.com",
    subject: "Quick check: next-step on the design handoff",
    preview:
      "The design team wants your decision on the approval path before the sprint demo.",
    body:
      "Hey, I want to make sure your review aligns with the stakeholder ask. The demo is on Thursday, and we need to decide if we can move the handoff to the operations team or keep it under the current schedule. Let me know if I should prepare a short summary for the skip-level review.",
    receivedAt: "1d ago",
    urgency: "Low",
    category: "Internal",
    originalLink: "/original/3",
    tags: ["Review", "Skip-level", "Design"],
  },
]

export const hoverDefinitions: Record<string, string> = {
  deliverables:
    "The concrete outputs or documents that your team needs to deliver for this project.",
  "launch timeline":
    "The schedule that determines when the product or program will go live and who needs to approve it.",
  stakeholder:
    "A person or group with influence over the project outcome who needs visibility or approval.",
  contract:
    "A formal agreement with terms, obligations, and language that should be clear and safe to sign.",
  translation:
    "The process of converting content into another language while keeping tone and intent intact.",
  "skip-level review":
    "A check by someone two levels above you, usually for alignment and risk visibility.",
}

export const languageOptions = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文 (Chinese)" },
  { code: "es", label: "Español (Spanish)" },
]

export const toneOptions = [
  { code: "manager", label: "Manager-ready" },
  { code: "stakeholder", label: "Stakeholder-friendly" },
  { code: "landlord", label: "Direct but respectful" },
]
