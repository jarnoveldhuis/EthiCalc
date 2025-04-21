// src/features/analysis/promptTemplates.ts

export const transactionAnalysisPrompt =
`Objective: Evaluate the societal debt (ethical impact) of financial transactions based on the percentage of a merchant's income spent on specific practices.

Instructions:
* Assign "unethicalPractices" and "ethicalPractices" using relevant industry knowledge and provided benchmarks where applicable (e.g., Factory Farming: 40-90%, Labor Exploitation: 20-70%).
* Assign "practiceWeights" (0-100%) reflecting the *ethical impact* based on financial allocation.
* **If uncertain about a merchant or practice applicability, assign NO practices.** Prioritize clearly impactful practices directly related to the merchant.
* **REQUIRED:** Output MUST include the original "plaidTransactionId" for each transaction.
* Provide concise "information" per practice, describing the impact and justifying the weight. Prioritize emotional resonance describing suffering caused by practice.
* **USE SEARCH FOR VERIFICATION:** Use Google Search to find recent, reliable information and citations to support your analysis, especially regarding specific company practices and their impacts.
* **Citations Field:** If available, provide a separate "citations" field mapping each practice name to an **ARRAY of source URL strings (string[])**.
* **PRIORITIZE URL QUALITY & RELEVANCE:**
    * Only include citation URLs that are **valid, publicly accessible, directly relevant** to the specific practice and merchant, and ideally published within the **last 2-3 years**.
    * URLs MUST be from **independent, reliable sources** (reputable news, watchdog groups, government agencies, academic research).
    * **DO NOT cite the vendor's own website**, press releases, or marketing materials as primary evidence for ethical/unethical practices (citing their stated goals from official reports is okay if noted in 'information').
    * **It is better to provide an empty array [] than an irrelevant or broken link.** If no suitable citation is found for a practice, use [].
* **ENSURE URLS ARE COMPLETE:** Double-check that any provided URL is a complete, absolute URL (e.g., "https://www.example.com/report").
* Generate specific "practiceSearchTerms" for charity lookups (e.g., Factory Farming -> "animal welfare", High Emissions -> "climate").
* Assign one of the following "practiceCategories" to each practice: Environment, Animal Welfare, Labor Ethics, Political Ethics, Transparency, Digital Rights.
* **Output MUST BE ONLY strict JSON** matching the example schema below. DO NOT include any explanatory text before or after the JSON block.

JSON Schema Example (Note 'citations' uses arrays):
{
"transactions": [
  {
    "plaidTransactionId": "abc123xyzSAMPLE",
    "date": "YYYY-MM-DD",
    "name": "McDonald's",
    "amount": 12.99,
    "unethicalPractices": ["Factory Farming", "High Emissions"],
    "ethicalPractices": [],
    "practiceWeights": {
        "Factory Farming": 75,
        "High Emissions": 25
    },
    "practiceSearchTerms": {
        "Factory Farming": "animal welfare",
        "High Emissions": "climate"
    },
    "practiceCategories": {
        "Factory Farming": "Animal Welfare", // Changed Category
        "High Emissions": "Environment" // Changed Category
    },
    "information": {
        "Factory Farming": "Relies on industrial meat production with environmental and animal welfare concerns.",
        "High Emissions": "Produces significant greenhouse gas emissions from its operations and supply chain."
    },
    "citations": {
         "Factory Farming": [ // Example with one URL
            "https://example-report.org/mcd-animal-welfare-2024"
         ],
         "High Emissions": [] // Example with NO suitable URL found
    }
  },
  {
    "plaidTransactionId": "def456uvwSAMPLE",
    "date": "YYYY-MM-DD",
    "name": "Amazon",
    "amount": 45.50,
    "unethicalPractices": ["Labor Exploitation", "Excessive Packaging"],
    "ethicalPractices": ["Cloud Efficiency"],
    "practiceWeights": {
        "Labor Exploitation": 30,
        "Excessive Packaging": 15,
        "Cloud Efficiency": 10
    },
    "practiceSearchTerms": {
        "Labor Exploitation": "workers rights",
        "Excessive Packaging": "waste reduction",
        "Cloud Efficiency": "data center sustainability"
    },
    "practiceCategories": {
        "Labor Exploitation": "Labor Ethics",
        "Excessive Packaging": "Environment",
        "Cloud Efficiency": "Environment"
    },
    "information": {
        "Labor Exploitation": "Reports persist regarding warehouse working conditions and labor practices.",
        "Excessive Packaging": "Significant use of packaging materials contributes to waste.",
        "Cloud Efficiency": "AWS infrastructure aims for energy efficiency improvements."
    },
    "citations": {
         "Labor Exploitation": [ // Example with multiple URLs
             "https://news-source.com/amazon-warehouse-conditions-probe",
             "https://labor-watchdog.org/amazon-report-2025"
         ],
         "Excessive Packaging": [
            "https://packaging-journal.net/amazon-waste-stats"
         ],
         "Cloud Efficiency": [] // Example where stated goal might not have independent citation
    }
  },
  {
    "plaidTransactionId": "ghi789jklSAMPLE",
    "date": "YYYY-MM-DD",
    "name": "Local Coffee Shop",
    "amount": 4.75,
    "unethicalPractices": [],
    "ethicalPractices": ["Community Support"], // Hypothetical
    "practiceWeights": {
        "Community Support": 15
    },
    "practiceSearchTerms": {
        "Community Support": "local business support"
    },
    "practiceCategories": {
        "Community Support": "Transparency" // Or other relevant category
    },
    "information": {
        "Community Support": "Supports local events and sources beans from a regional roaster."
    },
    "citations": {
        "Community Support": [] // Example with no unethical practices and no citation needed/found for ethical one
    }
  }
]
}
`;