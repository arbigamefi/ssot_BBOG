export type LegalSlug = "terms" | "privacy" | "disclaimer";

export type LegalSection = {
  title: string;
  body: string;
};

export type LegalPageContent = {
  slug: LegalSlug;
  eyebrow: string;
  title: string;
  description: string;
  highlights: readonly string[];
  sections: readonly LegalSection[];
};

export const LEGAL_PAGES: Record<LegalSlug, LegalPageContent> = {
  terms: {
    slug: "terms",
    eyebrow: "Legal",
    title: "Terms of Service",
    description:
      "These terms govern access to the ArbiGameFi frontend and the wallet-native interfaces used to reach rooms, bankroll pages, referral surfaces, and operational proof views.",
    highlights: [
      "The frontend is an interface for public on-chain systems.",
      "Users remain responsible for wallet custody, transaction review, gas, and local compliance.",
      "Availability can depend on RPC providers, indexers, oracle flows, wallets, and smart contracts."
    ],
    sections: [
      {
        title: "Use of the frontend",
        body: "The ArbiGameFi frontend presents wallet-native access to on-chain game rooms and bankroll surfaces. Access to the frontend does not remove the need to review transaction contents, quoted fees, network conditions, or the contracts being called before signing."
      },
      {
        title: "Wallets and execution",
        body: "Users retain custody of their wallets and private keys. ArbiGameFi does not take custody of wallets, cannot recover private keys, and cannot reverse transactions that have been confirmed by the relevant network."
      },
      {
        title: "Protocol and room risk",
        body: "Live rooms depend on smart contracts, randomness or oracle providers, indexers, RPC infrastructure, and third-party wallet providers. Service availability and outcome visibility may be affected by any of these layers."
      },
      {
        title: "No universal availability",
        body: "The frontend may not be available in every jurisdiction, network condition, browser environment, or release channel. Users are responsible for determining whether access or participation is permitted where they are located."
      }
    ]
  },
  privacy: {
    slug: "privacy",
    eyebrow: "Legal",
    title: "Privacy Policy",
    description:
      "ArbiGameFi is built around public-chain execution. This policy explains the limited data the frontend may process in addition to wallet and transaction data already visible on-chain.",
    highlights: [
      "Wallet addresses and transaction hashes may be displayed when they are already public on-chain.",
      "Product analytics and performance telemetry may be used to improve reliability and usability.",
      "Wallet connectors, RPC providers, indexers, and oracle integrations may process request metadata."
    ],
    sections: [
      {
        title: "Public blockchain data",
        body: "Wallet addresses, transaction hashes, bet states, settlement outcomes, and bankroll activity may be rendered in public room feeds because they are already visible on-chain."
      },
      {
        title: "Frontend analytics",
        body: "The frontend may collect product analytics, performance metrics, and engagement signals to improve room layouts, onboarding, operational visibility, and release quality."
      },
      {
        title: "Third-party services",
        body: "Wallet connectors, RPC providers, indexers, analytics services, and oracle integrations may process request metadata as part of normal operation. Their own terms and privacy rules also apply."
      },
      {
        title: "Data minimization",
        body: "The product should avoid collecting private keys, seed phrases, unnecessary personal identifiers, or raw wallet activity that is not required for product reliability, fraud prevention, or legal compliance."
      }
    ]
  },
  disclaimer: {
    slug: "disclaimer",
    eyebrow: "Risk notice",
    title: "Risk Disclaimer",
    description:
      "ArbiGameFi presents interfaces for on-chain gaming and bankroll participation. Interacting with these systems involves financial, legal, and technical risks.",
    highlights: [
      "Smart contracts, randomness providers, indexers, RPC endpoints, and wallet clients can fail or lag.",
      "Bankroll participation is subject to reserve usage, liability accounting, and protocol-specific exits.",
      "Users are responsible for determining whether participation is lawful in their jurisdiction."
    ],
    sections: [
      {
        title: "Protocol risk",
        body: "Smart contract bugs, oracle disruptions, delayed finality, indexer lag, wallet client failures, or network congestion can affect the user experience or temporarily affect room visibility."
      },
      {
        title: "Market and liquidity risk",
        body: "Bankroll participation is subject to reserve usage, liability accounting, and protocol-specific exit rules. Availability of deposits, withdrawals, and redemptions may change with room activity."
      },
      {
        title: "Outcome and settlement risk",
        body: "Casino rooms and sports markets can depend on randomness or external facts. Settlement may be delayed when providers lag, disputes occur, or network conditions prevent timely transaction confirmation."
      },
      {
        title: "Jurisdiction and compliance",
        body: "Users must determine for themselves whether use of the frontend, room participation, sports market participation, or LP activity is lawful in their jurisdiction."
      }
    ]
  }
};

export const LEGAL_NAV: ReadonlyArray<{ slug: LegalSlug; href: string; label: string }> = [
  { slug: "terms", href: "/legal/terms", label: "Terms" },
  { slug: "privacy", href: "/legal/privacy", label: "Privacy" },
  { slug: "disclaimer", href: "/legal/disclaimer", label: "Risk disclaimer" }
];
