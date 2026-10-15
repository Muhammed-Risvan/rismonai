import type { CompetencyMap } from "@/core/content";

/**
 * Seed Cloud Security Engineer competency map (M0).
 *
 * This is a SMALL, reviewed seed — enough to prove the M0 contracts load and
 * validate and to anchor the first beginner arc. It is intentionally NOT a
 * comprehensive curriculum: the full reviewed content is authored in M4. The
 * prerequisite edges below form a valid DAG (validated by the content tests).
 *
 * Honesty note: this seed defines structure, not job-readiness. Do not claim
 * comprehensive coverage until M4 content and learner evidence justify it.
 */
export const cloudSecurityEngineerMap: CompetencyMap = {
  ambitionId: "cloud-security-engineer",
  version: "0.1.0",
  lastReviewed: "2026-10-12",
  capabilities: [
    {
      id: "cloud-shared-responsibility",
      title: "Cloud shared responsibility model",
      summary:
        "Understand which security duties belong to the cloud provider and which belong to you, so you protect the right layer.",
      level: "beginner",
      prerequisites: [],
    },
    {
      id: "identity-and-access-basics",
      title: "Identity and access fundamentals",
      summary:
        "Explain authentication vs authorization and why least privilege limits blast radius.",
      level: "beginner",
      prerequisites: ["cloud-shared-responsibility"],
    },
    {
      id: "network-security-basics",
      title: "Network security fundamentals",
      summary:
        "Describe segmentation, security groups, and exposure so you can reduce an attacker's reachable surface.",
      level: "beginner",
      prerequisites: ["cloud-shared-responsibility"],
    },
    {
      id: "logging-and-monitoring",
      title: "Logging, monitoring, and detection",
      summary:
        "Know which logs matter and how to detect suspicious activity rather than assuming you would notice it.",
      level: "intermediate",
      prerequisites: ["identity-and-access-basics", "network-security-basics"],
    },
  ],
  objectives: [
    {
      id: "explain-shared-responsibility",
      title: "Explain the shared responsibility model",
      statement:
        "Given a cloud service, state which security controls are the provider's and which are yours.",
      capabilityIds: ["cloud-shared-responsibility"],
    },
    {
      id: "apply-least-privilege",
      title: "Apply least privilege to a simple access decision",
      statement:
        "For a described workload, choose the narrower of two access options and justify it.",
      capabilityIds: ["identity-and-access-basics"],
    },
  ],
  lessons: [
    {
      id: "lesson-shared-responsibility",
      title: "Who secures what in the cloud",
      objectiveId: "explain-shared-responsibility",
      capabilityIds: ["cloud-shared-responsibility"],
      whyItMatters:
        "Most cloud breaches happen in the customer's layer. Knowing the boundary tells you where to spend effort.",
      analogy:
        "Like renting an apartment: the landlord secures the building, but you still lock your own door.",
      example:
        "The provider patches the hypervisor; you still own your OS config, IAM policies, and data.",
    },
    {
      id: "lesson-least-privilege",
      title: "Least privilege in one idea",
      objectiveId: "apply-least-privilege",
      capabilityIds: ["identity-and-access-basics"],
      whyItMatters:
        "Over-permissioned identities turn a small mistake into a large breach.",
      analogy:
        "Give a temp worker only the keys to the rooms they need, not the master key.",
      example:
        "A reporting service needs read-only access to one bucket, not admin on the whole account.",
    },
  ],
  exercises: [
    {
      id: "exercise-shared-responsibility-mcq",
      prompt:
        "In the shared responsibility model, who is responsible for patching the guest operating system on your EC2 instance? (provider / you)",
      capabilityIds: ["cloud-shared-responsibility"],
      kind: "assessment",
      answerKey: { accepted: ["you"] },
      hints: ["Think about who configures and controls the instance."],
      reprobeOf: null,
      misconceptionSignatures: [
        {
          answer: "provider",
          misconceptionId: "misconception-provider-secures-everything",
        },
      ],
    },
    {
      id: "exercise-shared-boundary-check",
      prompt:
        "Your team stores customer files in a cloud storage bucket. Who is responsible for making sure the bucket is not accidentally public: the cloud provider, or you? (provider / you)",
      capabilityIds: ["cloud-shared-responsibility"],
      kind: "assessment",
      answerKey: { accepted: ["you"] },
      hints: ["Think about who chose the sharing settings."],
      // Remedial re-probe: only asked when the learner got the general
      // shared-responsibility question wrong, to confirm the boundary is
      // missing rather than just one phrasing being unfamiliar.
      reprobeOf: "exercise-shared-responsibility-mcq",
      misconceptionSignatures: [
        {
          answer: "provider",
          misconceptionId: "misconception-provider-secures-everything",
        },
      ],
    },
    {
      id: "exercise-identity-allowlist-assessment",
      prompt:
        "A support engineer only resets passwords. Should their account get read-only access to user profiles, or full administrator access? (read-only / administrator)",
      capabilityIds: ["identity-and-access-basics"],
      kind: "assessment",
      answerKey: { accepted: ["read-only"] },
      hints: ["Give only the access the job actually needs."],
      reprobeOf: null,
      misconceptionSignatures: [
        {
          answer: "administrator",
          misconceptionId: "misconception-admin-is-safer",
        },
      ],
    },
    {
      id: "exercise-network-exposure-assessment",
      prompt:
        "A database should only be reachable from inside your private network. Should it get a public internet address, or stay private-only? (public / private-only)",
      capabilityIds: ["network-security-basics"],
      kind: "assessment",
      answerKey: { accepted: ["private-only"] },
      hints: ["Fewer reachable doors means a smaller attack surface."],
      reprobeOf: null,
      misconceptionSignatures: [
        {
          answer: "public",
          misconceptionId: "misconception-public-is-convenient",
        },
      ],
    },
    {
      id: "exercise-detection-signal-assessment",
      prompt:
        "An alert says someone signed in from a new country at 3am and downloaded your billing export. Which log answers who did it: the sign-in log, or the coffee machine log? (sign-in log / coffee machine log)",
      capabilityIds: ["logging-and-monitoring"],
      kind: "assessment",
      answerKey: { accepted: ["sign-in log"] },
      hints: ["Ask which record tracks logins."],
      reprobeOf: null,
      misconceptionSignatures: [],
    },
    {
      id: "exercise-least-privilege-choice",
      prompt:
        "A service only reads reports. Which is better: full admin access, or read-only access to the reports bucket? (admin / read-only)",
      capabilityIds: ["identity-and-access-basics"],
      kind: "practice",
      answerKey: { accepted: ["read-only"] },
      hints: ["Choose the option that limits what could go wrong."],
      reprobeOf: null,
      misconceptionSignatures: [],
    },
  ],
  misconceptions: [
    {
      id: "misconception-provider-secures-everything",
      capabilityId: "cloud-shared-responsibility",
      description:
        "Believing the cloud provider secures everything, so the customer has no security duties.",
      remediation:
        "Revisit the boundary: the provider secures the cloud; you secure what you put in it.",
    },
    {
      id: "misconception-admin-is-safer",
      capabilityId: "identity-and-access-basics",
      description:
        "Believing broad admin access is safer because it avoids permission errors.",
      remediation:
        "Show how least privilege limits blast radius when something goes wrong.",
    },
    {
      id: "misconception-public-is-convenient",
      capabilityId: "network-security-basics",
      description:
        "Believing a resource should be reachable from the internet because it is easier to test and manage.",
      remediation:
        "Contrast the reachability you chose with the reachability you needed, then show the exposure that difference creates.",
    },
  ],
};
