import type { EntryKind, FrameworkStructure } from "./types";

export type StarterDraft = {
  kind: EntryKind;
  title: string;
  body: string;
  summary: string;
  tags: string[];
  variables: string[];
  semanticPhrases: string[];
  structure: FrameworkStructure | null;
};

export const STARTER_LIBRARY: StarterDraft[] = [
  {
    kind: "system",
    title: "Coding agent constitution",
    summary:
      "A tight system prompt for a software agent: inspect first, change only what was asked, prove it works, never invent APIs.",
    tags: ["coding", "agent", "system", "constitution"],
    variables: ["language", "repo_context"],
    semanticPhrases: [
      "software engineering agent rules",
      "don't hallucinate APIs",
      "read the code before editing",
      "prove the change with a test or command",
      "coding copilot system prompt",
      "pair programmer constitution",
      "minimum diff discipline",
      "agent that writes tests",
      "PR review coding assistant",
      "follow existing style",
    ],
    structure: {
      principles: ["Inspect before you edit", "Change only what was asked", "Match existing style", "Prove the change"],
      steps: ["Locate the relevant files", "State the plan in one short paragraph", "Apply the smallest correct diff", "Run the closest test or typecheck"],
      templates: [],
      antiPatterns: ["Rewriting unrelated files", "Inventing libraries that are not in the repo", "Claiming tests passed without running them"],
    },
    body: `You are a software engineering agent working in an existing repository.\n\nRules:\n- Read the relevant files before you change them.\n- Do the task that was asked — nothing adjacent, decorative, or "while I'm here".\n- Match the local style, naming, and architecture. Do not introduce a second pattern.\n- Never invent APIs, packages, or flags. If you are unsure, inspect the code or docs in the repo.\n- After a behavior change, run the closest test, typecheck, or command and report what you actually ran.\n- If you cannot verify, say so plainly.\n\nWhen you are stuck, say what you tried and what is blocking you. Do not pad the diff.`,
  },
  {
    kind: "framework",
    title: "Role, context, task, constraints",
    summary:
      "A reusable prompt framework: lock the role, give only the context that matters, state the task as a verb, then list hard constraints and the output shape.",
    tags: ["framework", "structure", "rctc"],
    variables: ["role", "context", "task", "constraints", "output"],
    semanticPhrases: ["CRISPE", "role playing prompt", "how to structure a prompt", "task plus constraints template", "output format first", "prompt engineering skeleton", "system prompt outline", "reusable prompt method", "who does what with which limits"],
    structure: {
      principles: ["Role before task", "Context is evidence, not lore", "Constraints are tests the output must pass"],
      steps: ["Name the role in one line", "Paste only the context the model cannot know", "State the task as an imperative", "List constraints as bullets", "Specify the output shape"],
      templates: ["You are {role}.\nContext:\n{context}\nTask: {task}\nConstraints:\n- {constraints}\nOutput: {output}"],
      antiPatterns: ["Long personality paragraphs", "Hiding the actual ask in a story", "Constraints that contradict the task"],
    },
    body: `Framework — Role / Context / Task / Constraints\n\n1. Role — one sentence. Who is speaking, with what authority.\n2. Context — only facts the model does not already have. Quotes, schema, examples.\n3. Task — one imperative verb phrase. The thing that must exist when this is done.\n4. Constraints — numbered, testable. Tone, length, things to avoid, tools it may not use.\n5. Output — exact shape (markdown, JSON keys, table columns).\n\nFill:\nYou are {role}.\nContext:\n{context}\nTask: {task}\nConstraints:\n- {constraints}\nOutput: {output}`,
  },
  {
    kind: "prompt",
    title: "Critique then rewrite",
    summary: "A user prompt that forces a two-pass edit: diagnose the piece, then rewrite it. Keeps the voice; cuts the fog.",
    tags: ["editing", "rewrite", "critique"],
    variables: ["piece", "audience", "goal"],
    semanticPhrases: ["edit my writing", "make this clearer", "tighten prose", "feedback then revision", "copy edit prompt", "improve this paragraph", "keep my voice", "red team this draft"],
    structure: null,
    body: `I need you to edit the piece below.\n\nAudience: {audience}\nGoal: {goal}\n\nPass 1 — Critique only, as bullets:\n- What is actually being said\n- Where it is vague, repeated, or performing\n- What should be cut\n- What is missing\n\nPass 2 — Rewrite the whole piece. Keep my voice and the facts. Do not add a preamble or a summary of your changes after the rewrite.\n\nPiece:\n{piece}`,
  },
  {
    kind: "system",
    title: "Retrieval-first researcher",
    summary: "A system prompt for research agents: search and quote sources before concluding. Marks uncertainty. Refuses to invent citations.",
    tags: ["research", "rag", "citations", "system"],
    variables: ["topic", "sources"],
    semanticPhrases: ["don't hallucinate", "cite your sources", "retrieval augmented generation", "research assistant system prompt", "ground answers in documents", "no fabricated citations", "literature review agent", "quote then conclude"],
    structure: {
      principles: ["Evidence before claim", "Quotes over paraphrase when stakes are high", "Unknown is a valid answer"],
      steps: ["Restate the question", "Gather sources", "Quote the relevant span", "Then conclude, with confidence"],
      templates: [],
      antiPatterns: ["Invented citations", "Answering from prior knowledge when sources were provided", "Hiding disagreement between sources"],
    },
    body: `You are a research agent. You do not answer from memory when sources are available.\n\nMethod:\n1. Restate the question in one line.\n2. Search or read the provided sources first.\n3. Quote the span that actually supports each claim (short, exact).\n4. Then write the conclusion. Separate evidence from inference.\n5. If sources disagree, say so. If they are silent, say "not in the sources" — do not fill the gap with a plausible story.\n6. Never invent a title, URL, quote, or page number.\n\nWhen no sources were given, say what you would need to look up before a responsible answer.`,
  },
  {
    kind: "framework",
    title: "Prompt evaluation rubric",
    summary: "A scoring framework for judging whether a prompt or system prompt will hold up: clarity, constraints, evaluability, failure modes.",
    tags: ["eval", "rubric", "quality", "framework"],
    variables: ["prompt_under_test"],
    semanticPhrases: ["score my prompt", "is this system prompt good", "prompt QA checklist", "evaluate prompt quality", "failure modes of instructions", "how to test a prompt", "grading rubric for prompts", "red team a system prompt"],
    structure: {
      principles: ["A prompt is a spec", "If you cannot fail it, you cannot improve it"],
      steps: ["Score each axis 1–5", "Name one failure case per weak axis", "Rewrite only the weakest clause"],
      templates: [],
      antiPatterns: ["Generic praise", "Rewriting the whole prompt when one clause is the leak"],
    },
    body: `Framework — Prompt evaluation rubric\n\nScore the prompt under test on each axis, 1 (broken) to 5 (tight). Give a one-line reason and one failure case.\n\nAxes:\n1. Task clarity — would two readers run the same job?\n2. Role fit — does the role actually change the output?\n3. Constraints — are they testable, or vibes?\n4. Context — is the model given what it cannot know, and nothing else?\n5. Output contract — can you parse or grade the result without a human shrug?\n6. Failure modes — what happens on empty input, hostile input, or missing facts?\n7. Evaluability — can you write three unit examples (input → good / bad)?\n\nThen: rewrite only the weakest clause. Do not restyle the rest.\n\nPrompt under test:\n{prompt_under_test}`,
  },
  {
    kind: "prompt",
    title: "Extract a reusable template",
    summary: "Turn a one-off prompt into a template with named variables, keeping the clauses that actually matter.",
    tags: ["template", "variables", "refactor"],
    variables: ["source_prompt"],
    semanticPhrases: ["parameterize this prompt", "turn into a template", "find the variables", "make this reusable", "prompt to framework", "extract placeholders", "generalize a one-off"],
    structure: null,
    body: `Turn the source prompt into a reusable template.\n\nRules:\n- Replace only the parts that change between runs with {snake_case} variables.\n- Keep the clauses that encode judgment, constraints, and output shape.\n- List the variables at the top with a one-line description each.\n- Do not weaken the original. If a concrete example is doing work, keep one example and mark it as such.\n\nSource:\n{source_prompt}`,
  },
];
