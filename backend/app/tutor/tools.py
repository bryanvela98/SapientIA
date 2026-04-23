TOOLS = [
    {
        "name": "diagnose",
        "description": "Probe what the learner already knows with a concrete, low-stakes question. Use when you don't yet have a model of their understanding.",
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {"type": "string", "description": "The diagnostic question to ask the learner."},
                "rationale": {"type": "string", "description": "Why this probe — what it will reveal."},
            },
            "required": ["question", "rationale"],
        },
    },
    {
        "name": "ask_socratic_question",
        "description": "Ask a leading question one step below where the learner is stuck, so their reasoning can proceed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "concept_targeted": {"type": "string", "description": "The concept this question is trying to unlock."},
            },
            "required": ["question", "concept_targeted"],
        },
    },
    {
        "name": "give_hint",
        "description": "Give a graded hint. Escalate level only after previous hint failed.",
        "input_schema": {
            "type": "object",
            "properties": {
                "hint": {"type": "string"},
                "level": {"type": "integer", "enum": [1, 2, 3], "description": "1=gentle nudge, 2=partial scaffold, 3=near-answer."},
                "concept_targeted": {"type": "string"},
            },
            "required": ["hint", "level", "concept_targeted"],
        },
    },
    {
        "name": "check_understanding",
        "description": "Ask the learner to justify, re-derive, or apply a claim they made.",
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "claim_being_checked": {"type": "string"},
            },
            "required": ["question", "claim_being_checked"],
        },
    },
    {
        "name": "mark_concept_earned",
        "description": "Record that the learner reasoned their way to a concept without being told. Can be called alongside another tool in sequence (call this first, then the next teaching move).",
        "input_schema": {
            "type": "object",
            "properties": {
                "concept": {"type": "string"},
                "evidence": {"type": "string", "description": "What the learner said that shows they earned it."},
            },
            "required": ["concept", "evidence"],
        },
    },
    {
        "name": "deliver_answer",
        "description": "Deliver a direct answer. ONLY use if learner has earned prerequisites OR has explicitly asked 3+ times and scaffolding is causing frustration. This counts as a 'told' concept.",
        "input_schema": {
            "type": "object",
            "properties": {
                "answer": {"type": "string"},
                "concept": {"type": "string"},
                "justification": {"type": "string", "description": "Why delivering now is the right call."},
            },
            "required": ["answer", "concept", "justification"],
        },
    },
]
