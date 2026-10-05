import Groq from "groq-sdk"

const apiKey = process.env.GROQ_API_KEY

if (!apiKey) {
  console.warn("GROQ_API_KEY is not configured")
}

const groq = new Groq({
  apiKey: apiKey || "missing-api-key",
})

export interface ShortNotes {
  depth?: NoteDepth
  organization?: NotesOrganization
  coreIdeas: string[]

  keyDefinitions: Array<{
    term: string
    definition: string
  }>

  importantFacts: string[]

  processes: string[]

  quickRevision: string
  sectionOverview?: string
  detailedExplanation?: string
  importantRelationships?: string[]
  examples?: string[]
  commonMistakes?: string[]
  sections?: ShortNoteSection[]
}

export type NoteDepth =
  | "quick"
  | "standard"
  | "detailed"
  | "deep"

export type NotesOrganization =
  | "whole"
  | "section"
  | "chapter"

export interface ShortNoteSection {
  title: string
  coreIdeas: string[]
  keyDefinitions: Array<{
    term: string
    definition: string
  }>
  importantFacts: string[]
  processes: string[]
  quickRevision: string
  sectionOverview?: string
  detailedExplanation?: string
  importantRelationships?: string[]
  examples: string[]
  commonMistakes: string[]
}

export interface Flashcard {
  question: string
  answer: string
}
export type QuizDifficulty =
  | "simple"
  | "medium"
  | "hard"

export interface QuizQuestion {
  question: string
  options: string[]
  answer: string
  explanation: string
}

const MAX_INPUT_CHARACTERS = 15000

const prepareMaterial = (content: string): string => {
  const cleaned = content
    .replace(/\s+/g, " ")
    .trim()

  if (cleaned.length <= MAX_INPUT_CHARACTERS) {
    return cleaned
  }

  return cleaned.slice(0, MAX_INPUT_CHARACTERS)
}

/* =========================================================
   SHORT NOTES
   ========================================================= */

const MAX_NOTES_SECTION_CHARACTERS = 6000
const MAX_NOTES_SECTIONS = 4

type NotesInputSection = {
  title: string
  content: string
}

const isNotesHeading = (
  line: string,
  organization: NotesOrganization,
): boolean => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 120) return false

  const chapterHeading =
    /^(?:chapter|unit|part)\s+(?:\d+|[ivxlcdm]+)\b.*$/i.test(trimmed)
  if (organization === "chapter") return chapterHeading

  return (
    chapterHeading ||
    /^(?:section|lesson|topic)\s+(?:\d+|[ivxlcdm]+)?\b.*$/i.test(
      trimmed,
    ) ||
    /^#{1,6}\s+\S/.test(trimmed) ||
    /^\d+(?:\.\d+)*[.)]?\s+[A-Z].{0,110}$/.test(trimmed) ||
    /^[A-Z][A-Z0-9\s:,&()-]{3,90}$/.test(trimmed)
  )
}

const detectNotesSections = (
  content: string,
  organization: NotesOrganization,
): NotesInputSection[] | null => {
  if (organization === "whole") return null

  const lines = content.replace(/\r\n?/g, "\n").split("\n")
  const headings: Array<{ index: number; title: string }> = []

  lines.forEach((line, index) => {
    if (isNotesHeading(line, organization)) {
      headings.push({
        index,
        title: line.trim().replace(/^#{1,6}\s+/, ""),
      })
    }
  })

  if (headings.length < 2) return null

  const preface = lines.slice(0, headings[0].index).join("\n").trim()
  const sections = headings.map((heading, index) => {
    const endIndex =
      headings[index + 1]?.index ?? lines.length
    const body = lines
      .slice(heading.index + 1, endIndex)
      .join("\n")
      .trim()
    return {
      title: heading.title,
      content:
        index === 0 && preface
          ? `${preface}\n\n${body}`
          : body,
    }
  }).filter((section) => section.content.length > 0)

  return sections.length >= 2 ? sections : null
}

const chunkNotesSection = (
  section: NotesInputSection,
): NotesInputSection[] => {
  if (section.content.length <= MAX_NOTES_SECTION_CHARACTERS) {
    return [section]
  }

  const paragraphs = section.content.split(/\n\s*\n/)
  const chunks: string[] = []
  let current = ""

  for (const paragraph of paragraphs) {
    if (paragraph.length > MAX_NOTES_SECTION_CHARACTERS) {
      if (current) {
        chunks.push(current)
        current = ""
      }
      for (
        let offset = 0;
        offset < paragraph.length;
        offset += MAX_NOTES_SECTION_CHARACTERS
      ) {
        chunks.push(
          paragraph.slice(
            offset,
            offset + MAX_NOTES_SECTION_CHARACTERS,
          ),
        )
      }
      continue
    }

    const combined = current
      ? `${current}\n\n${paragraph}`
      : paragraph
    if (combined.length > MAX_NOTES_SECTION_CHARACTERS) {
      chunks.push(current)
      current = paragraph
    } else {
      current = combined
    }
  }

  if (current) chunks.push(current)

  return chunks.map((content, index) => ({
    title:
      chunks.length > 1
        ? `${section.title} (part ${index + 1})`
        : section.title,
    content,
  }))
}

const parseShortNotes = (responseText: string): ShortNotes => {
  const parsed = JSON.parse(responseText)

  if (
    !Array.isArray(parsed.coreIdeas) ||
    !Array.isArray(parsed.keyDefinitions) ||
    !Array.isArray(parsed.importantFacts) ||
    !Array.isArray(parsed.processes) ||
    typeof parsed.quickRevision !== "string"
  ) {
    throw new Error("Invalid short notes structure")
  }

  return {
    coreIdeas: parsed.coreIdeas.filter(
      (item: unknown): item is string =>
        typeof item === "string" &&
        item.trim().length > 0,
    ),
    keyDefinitions: parsed.keyDefinitions.filter(
      (item: unknown): item is {
        term: string
        definition: string
      } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as any).term === "string" &&
        typeof (item as any).definition === "string",
    ),
    importantFacts: parsed.importantFacts.filter(
      (item: unknown): item is string =>
        typeof item === "string" &&
        item.trim().length > 0,
    ),
    processes: parsed.processes.filter(
      (item: unknown): item is string =>
        typeof item === "string" &&
        item.trim().length > 0,
    ),
    quickRevision: parsed.quickRevision.trim(),
      sectionOverview:
        typeof parsed.sectionOverview === "string"
          ? parsed.sectionOverview.trim()
          : "",
      detailedExplanation:
        typeof parsed.detailedExplanation === "string"
          ? parsed.detailedExplanation.trim()
          : "",
      importantRelationships: Array.isArray(
        parsed.importantRelationships,
      )
        ? parsed.importantRelationships.filter(
            (item: unknown): item is string =>
              typeof item === "string" && item.trim().length > 0,
          )
        : [],
    examples: Array.isArray(parsed.examples)
      ? parsed.examples.filter(
          (item: unknown): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [],
    commonMistakes: Array.isArray(parsed.commonMistakes)
      ? parsed.commonMistakes.filter(
          (item: unknown): item is string =>
            typeof item === "string" && item.trim().length > 0,
        )
      : [],
  }
}

const generateNotesForSection = async (
  content: string,
  subject: string,
  depth: NoteDepth,
): Promise<ShortNotes> => {
  const depthInstructions: Record<NoteDepth, string> = {
    quick:
      "QUICK: very concise revision; provide 3-5 high-value core ideas, definitions, and facts when supported. Keep explanations brief.",
    standard:
      "STANDARD: balanced study notes; provide about 5-8 useful ideas, definitions, and facts when supported. Include relevant processes.",
    detailed:
      "DETAILED: cover the important content with clear explanations, relationships, steps, and material-supported examples. Avoid padding.",
    deep:
      "DEEP STUDY: explain important concepts thoroughly, connect ideas, include material-supported examples and common mistakes where supported. Keep every section organized and avoid repetition or invented details.",
  }

  const prompt = `
You are Steady Mate, an AI study assistant for high school students.

Transform the supplied study material into accurate, useful study notes.

Subject:
${subject}

Selected note depth:
${depth}

${depthInstructions[depth]}

Return ONLY valid JSON. Do not use markdown or code fences.
Return exactly this structure:
{
  "coreIdeas": [],
  "keyDefinitions": [{"term": "", "definition": ""}],
  "importantFacts": [],
  "processes": [],
  "quickRevision": "",
  "sectionOverview": "",
  "detailedExplanation": "",
  "importantRelationships": [],
  "examples": [],
  "commonMistakes": []
}

Use only information supported by the supplied material. Do not repeat the
same idea across categories. Return empty arrays when a category is not
relevant or supported. Section overview, detailed explanation, important relationships,
examples, and common mistakes should only use information grounded in the
supplied material. Leave unsupported details empty. Keep explanation depth
consistent with the selected note depth.

STUDY MATERIAL:

${content}
`

  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    temperature: 0.2,
    max_completion_tokens: depth === "deep" ? 5000 : 3500,
    reasoning_effort: "low",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a reliable educational AI. Return only valid JSON.",
      },
      { role: "user", content: prompt },
    ],
  })

  const responseText =
    completion.choices[0]?.message?.content?.trim()
  if (!responseText) {
    throw new Error("AI returned an empty response")
  }

  try {
    return parseShortNotes(responseText)
  } catch {
    console.error("Invalid AI short notes JSON:", responseText)
    throw new Error("AI returned invalid short notes data")
  }
}

export const generateShortNotes = async (
  content: string,
  subject?: string,
  depth: NoteDepth = "standard",
  organization: NotesOrganization = "whole",
): Promise<ShortNotes> => {
  if (!content.trim()) {
    throw new Error("Study material is empty")
  }

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured")
  }

  if (!["quick", "standard", "detailed", "deep"].includes(depth)) {
    throw new Error("Invalid short notes depth")
  }
  if (!["whole", "section", "chapter"].includes(organization)) {
    throw new Error("Invalid notes organization")
  }

  const detectedSections = detectNotesSections(
    content,
    organization,
  )
  const sourceSections = detectedSections || [
    {
      title: subject?.trim() || "Study material",
      content: content.trim(),
    },
  ]
  const preparedChunks =
    !detectedSections &&
    content.length <= MAX_INPUT_CHARACTERS
      ? [
          {
            title: subject?.trim() || "Study material",
            content: prepareMaterial(content),
          },
        ]
      : sourceSections.flatMap(chunkNotesSection)

  const chunks: NotesInputSection[] = []
  for (const section of preparedChunks) {
    const labeledContent = `## ${section.title}\n${section.content}`
    const previous = chunks[chunks.length - 1]

    if (
      previous &&
      previous.content.length + labeledContent.length + 2 <=
        MAX_NOTES_SECTION_CHARACTERS
    ) {
      previous.content += `\n\n${labeledContent}`
      previous.title = `${previous.title} · ${section.title}`
    } else {
      chunks.push({
        title: section.title,
        content: labeledContent,
      })
    }
  }

  if (chunks.length > MAX_NOTES_SECTIONS) {
    throw new Error(
      "This material exceeds the note-generation request limit. Split it into smaller study materials and generate notes for each part.",
    )
  }

  const notesResults = await Promise.all(
    chunks.map((section) =>
      generateNotesForSection(
        prepareMaterial(section.content),
        section.title || subject?.trim() || "General",
        depth,
      ),
    ),
  )
  const mergeStrings = (
    field: "coreIdeas" | "importantFacts" | "processes" | "examples" | "commonMistakes",
  ) =>
    [...new Set(notesResults.flatMap((result) => result[field] || []))]
  const keyDefinitions = new Map<
    string,
    { term: string; definition: string }
  >()
  notesResults.forEach((result) =>
    result.keyDefinitions.forEach((definition) =>
      keyDefinitions.set(
        definition.term.toLocaleLowerCase(),
        definition,
      ),
    ),
  )

  return {
    depth,
    organization,
    coreIdeas: mergeStrings("coreIdeas"),
    keyDefinitions: [...keyDefinitions.values()],
    importantFacts: mergeStrings("importantFacts"),
    processes: mergeStrings("processes"),
    quickRevision: notesResults
      .map((result) => result.quickRevision)
      .filter(Boolean)
      .join("\n\n"),
    examples: mergeStrings("examples"),
    commonMistakes: mergeStrings("commonMistakes"),
    sections: detectedSections
      ? notesResults.map((result, index) => ({
          ...result,
          title: chunks[index].title,
          examples: result.examples || [],
          commonMistakes: result.commonMistakes || [],
        }))
      : [],
  }
}

/* =========================================================
   FLASHCARDS
   ========================================================= */

export const generateFlashcards = async (
  content: string,
  subject?: string,
): Promise<Flashcard[]> => {
  if (!content.trim()) {
    throw new Error("Study material is empty")
  }

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured")
  }

  const preparedContent = prepareMaterial(content)

  const prompt = `
You are Steady Mate, an AI study assistant.

Create useful flashcards from the supplied study material.

Subject:
${subject?.trim() || "General"}

Return ONLY valid JSON.

Return exactly:

{
  "flashcards": [
    {
      "question": "Question",
      "answer": "Answer"
    }
  ]
}

Rules:
- Create 8-12 flashcards when enough material exists.
- Focus on important concepts, definitions, facts, formulas, processes and relationships.
- Questions should test understanding and recall.
- Answers must be accurate and concise.
- Do not create duplicate cards.
- Do not invent information.
- Use ONLY the supplied study material.
- Keep each question and answer reasonably short.
- Do not use markdown.

STUDY MATERIAL:

${preparedContent}
`

  const completion =
    await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      temperature: 0.2,
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content:
            "You are a reliable educational AI. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    })

  const responseText =
    completion.choices[0]?.message?.content?.trim()

  if (!responseText) {
    throw new Error("AI returned an empty response")
  }

  try {
    const parsed = JSON.parse(responseText)

    if (!Array.isArray(parsed.flashcards)) {
      throw new Error("Invalid flashcard structure")
    }

    const cards = parsed.flashcards.filter(
      (item: unknown): item is Flashcard =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as any).question === "string" &&
        typeof (item as any).answer === "string" &&
        (item as any).question.trim().length > 0 &&
        (item as any).answer.trim().length > 0
    )

    if (!cards.length) {
      throw new Error("No valid flashcards returned")
    }

    return cards
  } catch {
    console.error(
      "Invalid AI flashcard JSON:",
      responseText
    )

    throw new Error(
      "AI returned invalid flashcard data"
    )
  }
}
/* =========================================================
   QUIZ
   ========================================================= */

export const generateQuiz = async (
  content: string,
  subject?: string,
  difficulty: QuizDifficulty = "medium",
): Promise<QuizQuestion[]> => {
  if (!content.trim()) {
    throw new Error("Study material is empty")
  }

  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured")
  }

  const preparedContent = prepareMaterial(content)

  const prompt = `
You are Steady Mate, an AI study assistant.

Create a useful multiple-choice quiz from the supplied study material.

Subject:
${subject?.trim() || "General"}

Difficulty:
${difficulty}

Return ONLY valid JSON.

Return exactly:

{
  "quiz": [
    {
      "question": "Question",
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "answer": "Correct option exactly as written",
      "explanation": "Short explanation of why the answer is correct."
    }
  ]
}

General Rules:
- Create 8-10 questions when enough material exists.
- Every question must have exactly 4 options.
- Only ONE option can be correct.
- The answer must exactly match one of the four options.
- Do not repeat questions.
- Do not invent information.
- Use ONLY the supplied study material.
- Keep explanations concise.
- Do not use markdown.

Difficulty Rules:

SIMPLE:
- Focus on basic recall and straightforward understanding.
- Ask clear questions about definitions, facts, concepts, formulas, and simple relationships.
- Avoid complicated calculations or multi-step reasoning.
- Make the questions suitable for a student learning the material for the first time.

MEDIUM:
- Test understanding, application, and moderate reasoning.
- Require students to connect concepts or apply what they learned.
- Include moderate calculations or multi-step thinking when supported by the material.
- Avoid questions that require information outside the supplied material.

HARD:
- Test deeper understanding, application, analysis, and problem solving.
- Include challenging multi-step reasoning when supported by the material.
- Use questions that require students to carefully compare, apply, or connect concepts.
- Make distractor options plausible but clearly incorrect based on the material.
- Never require knowledge that is not contained in the supplied material.

IMPORTANT:
Every question must match the selected difficulty level:
${difficulty}

STUDY MATERIAL:

${preparedContent}
`

  const completion =
    await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      temperature: 0.2,
      max_completion_tokens: 8192,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a reliable educational AI. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    })

  const choice = completion.choices[0]
  const message = choice?.message
  const responseText = message?.content?.trim()

  if (!responseText) {
    console.error("Groq returned no quiz content", {
      model: completion.model,
      choiceCount: completion.choices.length,
      finishReason: choice?.finish_reason,
      messageFields: message ? Object.keys(message) : [],
      contentType: typeof message?.content,
      reasoningPresent: Boolean(message?.reasoning),
      usage: completion.usage,
    })
    throw new Error("AI returned an empty response")
  }

  try {
    const parsed = JSON.parse(responseText)

    if (!Array.isArray(parsed.quiz)) {
      throw new Error("Invalid quiz structure")
    }

    const quiz = parsed.quiz.filter(
      (item: unknown): item is QuizQuestion =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as any).question === "string" &&
        Array.isArray((item as any).options) &&
        (item as any).options.length === 4 &&
        (item as any).options.every(
          (option: unknown) =>
            typeof option === "string"
        ) &&
        typeof (item as any).answer === "string" &&
        typeof (item as any).explanation === "string" &&
        (item as any).options.includes(
          (item as any).answer
        )
    )

    if (!quiz.length) {
      throw new Error("No valid quiz questions returned")
    }

    return quiz
  } catch {
    console.error(
      "Invalid AI quiz JSON:",
      responseText
    )

    throw new Error(
      "AI returned invalid quiz data"
    )
  }
}
