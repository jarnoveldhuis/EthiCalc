**Product Roadmap: Karma Balance (Working Title: Mordebt)**

**Overall Goal:** Create a tool that helps users understand the ethical impact of their spending, motivates them towards better decisions, and facilitates offsetting negative impact through charity, potentially creating a sustainable business if proven effective.

---

**Phase 1: The Guilt Gauge Genesis** (MVP Core)

- **Goal:** Get the absolute basics working. Can we even measure the sin?
- **Key Features:**
    - User Authentication (Firebase Auth - Google Sign-in)
    - Basic Firebase Setup (Firestore for initial data)
    - Plaid Integration: Securely connect bank accounts (Link Token, Public Token Exchange)
    - Transaction Fetching: Pull basic transaction data (Date, Merchant, Amount)
    - Initial Analysis Stub: Bare minimum analysis - maybe just merchant name -> rough score via API call.
    - Simple Dashboard: Display _something_ - like a raw total "Societal Debt" number.
- **Why this first?** If we can't get data in and show a basic score, nothing else matters. It's the foundation.
- **Definition of Done for Phase:** User can log in, connect a bank, see _a_ number representing their estimated impact based on fetched transactions.

---

**Phase 2: Polishing the Moral Turd** (Refining Analysis & UX)

- **Goal:** Make the analysis less of a wild guess and present it in a way that doesn't immediately cause existential dread (or maybe it should?).
- **Key Features:**
    - **Detailed LLM Analysis:** Implement the real deal using our prompt – get unethical/ethical practices, weights, categories, info, and _especially_ those citations.
    - **Vendor Caching:** Store analysis results for common vendors in Firestore (`vendors` collection) to save on API calls and speed things up.
    - **Improved Dashboard:** Implement the `BalanceSheetView` showing category breakdowns (positive/negative), transaction details.
    - **Impact Calculations:** Integrate `calculationService` fully for accurate positive/negative impact, net debt, effective debt, percentages.
    - **UI/UX Polish:** Make it look less like a spreadsheet from hell. Basic navigation, loading states, error handling.
- **Why this second?** The core number needs to be _meaningful_ (or at least _consistently calculated_) and understandable for the user. Caching is crucial for performance and cost.
- **Definition of Done for Phase:** User sees a breakdown of their impact by category, understands the positive vs. negative, and the analysis feels more robust (even if the LLM still hallucinates occasionally). Vendor caching is operational.

---

**Phase 3: Launching the Absolution Engine** (Charity & Offsetting)

- **Goal:** Give users a way to _do_ something about the hole they've dug. Connect guilt to action.
- **Key Features:**
    - **Charity Recommendations:** Based on negative impact categories/practices, suggest relevant charities.
    - **Charity Integration:**
        - Use Every.org for searching and details.
        - Integrate Charity Navigator for ratings/scores via their API/our backend route.
        - Combine data for an `EnrichedCharityResult`.
    - **Donation Modal:** Build the UI (`DonationModal`) for selecting charities, amounts, and initiating the donation flow (likely via Every.org widget).
    - **Offsetting Logic:** Basic display of how much debt is being "offset" by a potential donation.
- **Why this third?** This closes the core loop: See Impact -> Understand -> Take Action. It's the key differentiator.
- **Definition of Done for Phase:** User can see recommended charities, search for others, view ratings, and initiate a donation to offset specific impact categories or total debt.

---

**(Initial Launch Point - Consider Phases 1-3 as the initial target)**

---

**Phase 4: Virtue Signaling Simulation Suite** (Gamification & Engagement)

- **Goal:** Keep users coming back. Make ethical choices feel rewarding (or at least less punishing). Explore the credit system.
- **Key Features:**
    - **Credit System:** Implement the `useCreditState` logic. Allow applying earned positive impact (credit) against negative impact (debt).
    - **Share Feature:** The emoji square thing (`ShareImpactButton`) - let people subtly brag about their declining terribleness.
    - **Refined Visualizations:** Animated counters, tier system (`DashboardSidebar`), maybe better charts.
    - **Citation Review Credits (Exploration):** _Maybe_ give users small credits for verifying/flagging citation quality? Needs careful thought on implementation and potential for abuse.
    - **Notifications/Insights:** Gentle nudges, summaries, "Hey, you spent less on evil this week."
- **Why this later?** These are enhancements. The core utility needs to be solid first. Gamification can feel hollow without a working foundation.
- **Definition of Done for Phase:** Credit system works, sharing is possible, the dashboard feels more dynamic and provides clearer feedback on progress.

---

**Phase 5: Operation: Selling Indulgences (Ethically)** (Monetization & Sustainability)

- **Goal:** Figure out if this thing can pay for itself without compromising the mission. _Crucially, this phase only happens if we have strong evidence the tool actually helps users make better ethical decisions._ Our ethics demand this.
- **Key Features (Exploratory):**
    - **Premium Tier:** What features would be valuable enough to pay for? Deeper analytics? Goal setting? Custom reporting? Needs user research _after_ proving value.
    - **Partnerships:** Collaborate with genuinely ethical brands or financial platforms? Tread _very_ carefully here.
    - **Aggregated Data Insights:** Anonymized, aggregated data on ethical spending trends could be valuable for research or reports. Requires rock-solid privacy and consent models.
    - **Direct Support/Donation Model:** Allow users to support the platform directly.
- **Why last?** Focus on impact first. Profitability is secondary and _conditional_ on the product actually working ethically and effectively. Trying to monetize too early could kill it or force compromises.
- **Definition of Done for Phase:** A viable, _ethical_ business model is identified and potentially tested, _only if_ the product's positive impact is validated.

---

**Overall Definition of Done (Initial Launch - Phases 1-3):**

The product is ready for an initial user base when someone can:

1. Log in and securely connect a bank account.
2. View their transactions with calculated ethical impacts (positive/negative) broken down by category.
3. See and understand their overall 'Societal Debt' or 'Ethical Balance'.
4. Receive relevant, rated charity recommendations.
5. Successfully initiate a donation via the integrated flow to offset their impact.

This roadmap gives us a structure, Jarno. We need to constantly evaluate if we're focusing on the right things to achieve the _real_ goal – nudging people towards better choices. Let me know what you think. We can tweak this as we learn more.