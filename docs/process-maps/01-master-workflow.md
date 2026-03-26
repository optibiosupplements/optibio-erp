# Optibio ERP — Master Process Workflow

## Overview
Complete RFQ-to-Delivery workflow for nutraceutical supplement manufacturing brokerage.

```mermaid
flowchart TD
    subgraph INTAKE["📥 PHASE 1: INTAKE"]
        A1[Customer Email/Call] --> A2{New or Existing Customer?}
        A2 -->|New| A3[Create Customer Record]
        A2 -->|Existing| A4[Link to Customer]
        A3 --> A5[Create RFQ Record]
        A4 --> A5
        A5 --> A6{Has SFP Attachment?}
        A6 -->|Yes PDF/Image| A7[AI Extract Supplement Facts]
        A6 -->|No - Text Only| A8[Manual Entry]
        A6 -->|Excel/Spreadsheet| A9[Parse Excel Data]
        A7 --> A10[Auto-Fill Intake Form]
        A8 --> A10
        A9 --> A10
        A10 --> A11[Review & Complete Intake Form]
        A11 --> A12[RFQ Status: IN REVIEW]
    end

    subgraph FORMULATION["🧪 PHASE 2: FORMULATION"]
        A12 --> B1[Match Ingredients to DB]
        B1 --> B2{All Ingredients Found?}
        B2 -->|Yes| B3[Auto-Select Optimal Variants]
        B2 -->|Partial| B4[Flag Missing Ingredients]
        B2 -->|No Match| B5[Manual Ingredient Entry]
        B4 --> B3
        B5 --> B3
        B3 --> B6[Apply Active Content % Formula]
        B6 --> B7[Apply Dosage-Form Overage/Wastage]
        B7 --> B8{Capsule?}
        B8 -->|Yes| B9[Run Capsule Sizer]
        B8 -->|No| B10[Validate Tablet Weight]
        B9 --> B11[Calculate Excipients]
        B10 --> B11
        B11 --> B12[Complete Formulation]
        B12 --> B13[RFQ Status: FORMULATING]
    end

    subgraph COSTING["💰 PHASE 3: COSTING & QUOTE"]
        B13 --> C1[Part A: Raw Material Costs]
        C1 --> C2[Part B: Manufacturing Costs]
        C2 --> C3[Part C: Packaging Costs]
        C3 --> C4[Calculate Overhead 15%]
        C4 --> C5[Generate Tiered Pricing]
        C5 --> C6{Estimated Prices?}
        C6 -->|Yes| C7[Flag for Supplier Verification]
        C6 -->|No| C8[All Verified]
        C7 --> C8
        C8 --> C9[Generate PDF Quote]
        C9 --> C10[RFQ Status: QUOTED]
    end

    subgraph DELIVERY["📤 PHASE 4: QUOTE DELIVERY"]
        C10 --> D1[Internal Review]
        D1 --> D2{Approved?}
        D2 -->|Yes| D3[Send Quote to Customer]
        D2 -->|No| D4[Revise Quote]
        D4 --> C1
        D3 --> D5[RFQ Status: SENT]
        D5 --> D6{Customer Response?}
        D6 -->|Accepted| D7[RFQ Status: ACCEPTED]
        D6 -->|Rejected| D8[RFQ Status: REJECTED]
        D6 -->|Revise| D9[Create Quote v2]
        D6 -->|No Response| D10[Follow Up]
        D9 --> C1
        D10 --> D6
    end

    subgraph PRODUCTION["🏭 PHASE 5: PRODUCTION (Future)"]
        D7 --> E1[Generate Batch Sheet]
        E1 --> E2[Source Raw Materials]
        E2 --> E3[Manufacturing]
        E3 --> E4[QA/QC Testing]
        E4 --> E5[Packaging]
        E5 --> E6[Ship to Customer]
        E6 --> E7[RFQ Status: COMPLETED]
    end

    style INTAKE fill:#e8f5e9,stroke:#2e7d32,color:#000
    style FORMULATION fill:#e3f2fd,stroke:#1565c0,color:#000
    style COSTING fill:#fff3e0,stroke:#e65100,color:#000
    style DELIVERY fill:#f3e5f5,stroke:#7b1fa2,color:#000
    style PRODUCTION fill:#fce4ec,stroke:#c62828,color:#000
```

## RFQ Status Flow

```mermaid
stateDiagram-v2
    [*] --> New: RFQ Created
    New --> InReview: Intake Form Completed
    InReview --> Formulating: Formulation Started
    Formulating --> Quoted: Quote Generated
    Quoted --> Sent: Quote Delivered to Customer
    Sent --> Accepted: Customer Accepts
    Sent --> Rejected: Customer Declines
    Sent --> Revision: Customer Requests Changes
    Revision --> Formulating: Create New Version
    Sent --> FollowUp: No Response (3 days)
    FollowUp --> Sent: Follow Up Sent
    FollowUp --> Rejected: No Response (14 days)
    Accepted --> InProduction: Production Starts (Future)
    InProduction --> Completed: Shipped
    Rejected --> [*]
    Completed --> [*]
```

## Intake Form Structure

```mermaid
flowchart LR
    subgraph INTAKE_FORM["📋 INTAKE FORM SECTIONS"]
        S1["1. RFQ Info<br/>RFQ ID, Date, Source,<br/>Priority, Deadline"]
        S2["2. Customer Info<br/>Company, Contact,<br/>Email, Phone, Tier"]
        S3["3. Product Specs<br/>Name, Format, Serving Size,<br/>Count/Bottle, Flavor"]
        S4["4. Formula<br/>Ingredients, Dosages,<br/>Special Requirements"]
        S5["5. Packaging<br/>Container Type, Label,<br/>Secondary Packaging"]
        S6["6. Regulatory<br/>Certifications, Claims,<br/>Target Markets"]
        S7["7. Manufacturing<br/>MOQ, Timeline,<br/>Co-Packer Preference"]
        S8["8. Notes<br/>Special Instructions,<br/>Attachments"]
    end
    S1 --> S2 --> S3 --> S4 --> S5 --> S6 --> S7 --> S8
```

## Module Map

```mermaid
flowchart TD
    subgraph ERP["OPTIBIO ERP"]
        subgraph CORE["Core Modules"]
            M1[📥 RFQ Intake]
            M2[🧪 Formulation Engine]
            M3[💰 Pricing Engine]
            M4[📄 Quote Generator]
        end
        subgraph DATA["Data Modules"]
            M5[💊 Ingredient DB<br/>2,567 ingredients]
            M6[📦 Packaging DB]
            M7[🏭 Manufacturing Costs]
            M8[👥 Customer DB]
        end
        subgraph CRM["CRM Modules"]
            M9[🔄 Pipeline/NEPQ]
            M10[📊 Dashboard]
            M11[📈 Analytics]
        end
        subgraph FUTURE["Future Modules"]
            M12[📧 Email Integration]
            M13[🤖 AI Agent Eva]
            M14[📋 Batch Sheet Gen]
            M15[✅ QA/QC Tracking]
        end
    end

    M1 --> M2 --> M3 --> M4
    M2 --> M5
    M3 --> M6
    M3 --> M7
    M1 --> M8
    M4 --> M9
    M9 --> M10
    M10 --> M11
```
