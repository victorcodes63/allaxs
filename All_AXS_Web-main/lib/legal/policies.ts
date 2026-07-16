import type { LegalDocument } from "@/lib/legal/types";
import { PLATFORM_SUPPORT_EMAIL } from "@/lib/site-contact";

export const TERMS_AND_CONDITIONS: LegalDocument = {
  slug: "terms",
  title: "Terms & conditions",
  description: "Terms governing use of the All AXS Africa ticketing and events platform.",
  eyebrow: "Legal",
  sections: [
    {
      id: "welcome",
      title: "Welcome",
      blocks: [
        {
          type: "paragraph",
          text: "Welcome to All AXS Africa (“All AXS”, “we”, “our”, or “us”). By accessing or using our ticketing and events platform, you agree to comply with and be bound by the following Terms and Conditions. These terms apply to all users, including event organizers, ticket buyers, partners, vendors, and website visitors.",
        },
      ],
    },
    {
      id: "registration",
      title: "1. User registration and account responsibilities",
      blocks: [
        {
          type: "list",
          items: [
            "Users may be required to create an account to access certain platform features.",
            "Users agree to provide accurate, current, and complete information during registration and to update such information where necessary.",
            "Users are responsible for maintaining the confidentiality of their account credentials and for all activities conducted under their account.",
            "All AXS reserves the right to suspend or terminate accounts suspected of fraudulent, misleading, or unauthorized activity.",
          ],
        },
      ],
    },
    {
      id: "usage",
      title: "2. Platform usage rules and prohibited activities",
      blocks: [
        {
          type: "paragraph",
          text: "Users agree not to:",
        },
        {
          type: "list",
          items: [
            "Use the platform for unlawful or fraudulent purposes;",
            "Upload or distribute harmful, abusive, defamatory, or misleading content;",
            "Interfere with the operation or security of the platform;",
            "Attempt unauthorized access to accounts, systems, or data;",
            "Use bots, automated tools, or unauthorized software to purchase tickets;",
            "Resell tickets in violation of these Terms.",
          ],
        },
        {
          type: "paragraph",
          text: "All AXS reserves the right to remove content or restrict access for violations of these rules.",
        },
      ],
    },
    {
      id: "tickets",
      title: "3. Ticket purchase and resale conditions",
      blocks: [
        {
          type: "list",
          items: [
            "All ticket purchases are subject to availability and confirmation of payment.",
            "Tickets may not be duplicated, transferred, or resold without authorization from All AXS or the event organizer.",
            "Unauthorized resale or scalping of tickets may result in cancellation without refund.",
            "Ticket holders are responsible for reviewing event details, including dates, venue, and entry requirements before purchase.",
            "Refunds and cancellations shall be governed by the applicable Refund and Cancellation Policy.",
          ],
        },
      ],
    },
    {
      id: "organizers",
      title: "4. Event organizer obligations and compliance requirements",
      blocks: [
        {
          type: "paragraph",
          text: "Event organizers using the platform agree to:",
        },
        {
          type: "list",
          items: [
            "Provide accurate and lawful event information;",
            "Obtain all necessary permits, licenses, and approvals;",
            "Comply with applicable Kenyan laws and regulations;",
            "Honor valid tickets issued through the platform;",
            "Deliver events in a safe and professional manner;",
            "Comply with financial, tax, and payout requirements established by All AXS.",
          ],
        },
        {
          type: "paragraph",
          text: "All AXS reserves the right to suspend or remove events that violate legal or platform requirements. Organizer payouts are governed by the Organizer Payout and Financial Settlement Policy.",
        },
      ],
    },
    {
      id: "privacy",
      title: "5. Data privacy, protection, and user consent",
      blocks: [
        {
          type: "list",
          items: [
            "All AXS collects and processes personal information in accordance with applicable data protection laws, including the Kenya Data Protection Act, 2019.",
            "By using the platform, users consent to the collection, storage, and processing of their information for ticketing, communication, security, and operational purposes.",
            "Users may be required to provide identification or verification information for compliance and fraud prevention purposes.",
            "All AXS shall implement reasonable measures to protect user data from unauthorized access or misuse.",
          ],
        },
      ],
    },
    {
      id: "ip",
      title: "6. Intellectual property rights and content ownership",
      blocks: [
        {
          type: "list",
          items: [
            "All platform content, including trademarks, logos, text, graphics, software, and designs, are the property of All AXS or its licensors and are protected under applicable intellectual property laws.",
            "Users and organizers retain ownership of content they upload but grant All AXS a non-exclusive license to display, distribute, and promote such content in connection with the platform.",
            "No content from the platform may be copied, reproduced, or commercially exploited without prior written consent.",
          ],
        },
      ],
    },
    {
      id: "payments",
      title: "7. Payment processing and transaction responsibilities",
      blocks: [
        {
          type: "list",
          items: [
            "Payments processed through the platform may be handled by third-party payment providers.",
            "Users agree to provide valid payment information and authorize All AXS to process payments related to ticket purchases and services.",
            "All AXS shall not be responsible for delays or failures caused by third-party financial institutions or payment providers.",
            "Organizers are responsible for ensuring that their payout and banking information is accurate and up to date.",
          ],
        },
      ],
    },
    {
      id: "liability",
      title: "8. Limitation of liability and indemnification",
      blocks: [
        {
          type: "list",
          items: [
            "All AXS acts as a technology and ticketing platform and is not responsible for the actual execution, quality, safety, or cancellation of events hosted by organizers.",
            "To the fullest extent permitted by law, All AXS shall not be liable for indirect, incidental, consequential, or special damages arising from the use of the platform.",
            "Users and organizers agree to indemnify and hold harmless All AXS, its affiliates, employees, and partners from claims, damages, liabilities, and expenses resulting from misuse of the platform or violation of these Terms.",
          ],
        },
      ],
    },
    {
      id: "termination",
      title: "9. Cancellation, suspension, and termination rights",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS reserves the right to suspend or terminate user accounts, events, or access to the platform where there is:",
        },
        {
          type: "list",
          items: [
            "Violation of these Terms;",
            "Fraudulent or illegal activity;",
            "Security concerns;",
            "Abuse of the platform or other users.",
          ],
        },
        {
          type: "list",
          items: [
            "Users may discontinue use of the platform at any time.",
            "Termination does not waive any outstanding obligations or liabilities accrued before termination.",
          ],
        },
      ],
    },
    {
      id: "disputes",
      title: "10. Dispute resolution mechanisms",
      blocks: [
        {
          type: "list",
          items: [
            "Parties agree to first attempt to resolve disputes amicably through written notice and negotiation.",
            "Where disputes remain unresolved, the matter may be referred to mediation or arbitration in Kenya in accordance with applicable laws.",
            "Nothing in these Terms limits either party’s right to seek relief through competent courts where necessary.",
          ],
        },
      ],
    },
    {
      id: "law",
      title: "11. Governing law",
      blocks: [
        {
          type: "paragraph",
          text: "These Terms and Conditions shall be governed by and interpreted in accordance with the laws of the Republic of Kenya.",
        },
      ],
    },
    {
      id: "third-party",
      title: "12. Third-party integrations and external services disclaimer",
      blocks: [
        {
          type: "list",
          items: [
            "The platform may integrate with third-party services including payment gateways, analytics providers, communication tools, or social media platforms.",
            "All AXS is not responsible for the availability, security, or practices of third-party services.",
            "Users access third-party services at their own risk and subject to the respective provider’s terms and policies.",
          ],
        },
      ],
    },
    {
      id: "fraud",
      title: "13. Fraud prevention and anti-scalping provisions",
      blocks: [
        {
          type: "list",
          items: [
            "All AXS reserves the right to investigate suspicious transactions, fraudulent purchases, or unauthorized ticket resales.",
            "Tickets obtained through fraudulent means may be canceled without refund.",
            "The use of automated purchasing software, bots, or unauthorized bulk purchasing mechanisms is strictly prohibited.",
            "All AXS may impose ticket purchase limits or verification procedures to prevent abuse and scalping.",
          ],
        },
      ],
    },
    {
      id: "communications",
      title: "14. Communication consent (email/SMS notifications)",
      blocks: [
        {
          type: "list",
          items: [
            "By creating an account or purchasing tickets, users consent to receive transactional communications relating to their account, tickets, events, and platform activity.",
            "Users may also receive promotional communications, newsletters, and marketing updates where consent has been provided.",
            "Users may opt out of non-essential marketing communications at any time through the provided unsubscribe mechanisms.",
            "All AXS shall not be responsible for delays or failures in message delivery caused by telecommunication providers or third-party systems.",
          ],
        },
      ],
    },
    {
      id: "amendments",
      title: "15. Amendments to terms and conditions",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS reserves the right to update or modify these Terms and Conditions at any time. Continued use of the platform following any changes constitutes acceptance of the revised Terms.",
        },
      ],
    },
  ],
};

export const REFUND_POLICY: LegalDocument = {
  slug: "refund-policy",
  title: "Refund & cancellation policy",
  description:
    "How refunds and cancellations are handled for tickets purchased through All AXS Africa.",
  eyebrow: "Legal",
  sections: [
    {
      id: "introduction",
      title: "1. Introduction",
      blocks: [
        {
          type: "paragraph",
          text: "This Refund and Cancellation Policy (“Policy”) governs all ticket purchases made through the All AXS Africa (“All AXS”, “we”, “our”, or “us”) ticketing and events platform. By purchasing a ticket through the platform, users agree to comply with this Policy in addition to the platform’s Terms and Conditions.",
        },
        {
          type: "paragraph",
          text: "This Policy applies to all ticket buyers, event organizers, promoters, and partners using the All AXS platform.",
        },
      ],
    },
    {
      id: "general-structure",
      title: "2. General refund structure",
      blocks: [
        {
          type: "paragraph",
          text: "Unless otherwise specified by the event organizer or event-specific terms:",
        },
        {
          type: "list",
          items: [
            "Eligible refunds shall be processed at 75% of the original ticket purchase value.",
            "25% of the ticket value shall be retained by All AXS Africa as administrative, transaction, payment processing, and operational fees.",
            "Service charges, payment gateway fees, convenience fees, and third-party transaction costs may be non-refundable.",
          ],
        },
        {
          type: "paragraph",
          text: "Refunds shall only apply to eligible requests approved under this Policy.",
        },
      ],
    },
    {
      id: "eligibility",
      title: "3. Refund eligibility requirements",
      blocks: [
        {
          type: "paragraph",
          text: "Refund requests may be considered under the following circumstances.",
        },
        {
          type: "paragraph",
          text: "Eligible scenarios:",
        },
        {
          type: "list",
          items: [
            "Event cancellation by the organizer;",
            "Major event postponement or rescheduling;",
            "Duplicate ticket purchases;",
            "Incorrect billing caused by system error;",
            "Unauthorized or fraudulent transactions under investigation;",
            "Failure to deliver purchased tickets due to platform error;",
            "Material changes to the event significantly affecting attendance.",
          ],
        },
        {
          type: "paragraph",
          text: "Non-eligible scenarios — refunds shall generally not be issued where:",
        },
        {
          type: "list",
          items: [
            "The ticket holder can no longer attend the event;",
            "The user purchased the wrong ticket type;",
            "Personal scheduling conflicts arise;",
            "Travel, accommodation, or transport issues occur;",
            "Tickets were purchased from unauthorized resellers;",
            "Requests are submitted after the permitted refund period.",
          ],
        },
        {
          type: "paragraph",
          text: "Event-specific policies may override general eligibility requirements where clearly disclosed during purchase.",
        },
      ],
    },
    {
      id: "cancellation",
      title: "4. Event cancellation procedures",
      blocks: [
        {
          type: "paragraph",
          text: "4.1 Organizer cancellation — Where an event is officially canceled by the organizer:",
        },
        {
          type: "list",
          items: [
            "Ticket holders shall be notified via email, SMS, or platform notification;",
            "Eligible refunds shall be processed automatically where possible;",
            "Refund timelines may vary depending on payment providers and banking institutions.",
          ],
        },
        {
          type: "paragraph",
          text: "4.2 Force majeure events — Refund obligations may be affected where cancellations result from circumstances beyond reasonable control, including natural disasters, government restrictions, public health emergencies, civil unrest, venue shutdowns, or technical infrastructure failures. In such cases, organizers may offer ticket transfers, event credits, rescheduled attendance options, or partial refunds.",
        },
      ],
    },
    {
      id: "postponement",
      title: "5. Event postponement and rescheduling",
      blocks: [
        {
          type: "list",
          items: [
            "Purchased tickets may remain valid for the new event date;",
            "Users unable to attend the revised date may submit a refund request within the communicated refund window;",
            "Refund approval may require organizer authorization.",
          ],
        },
        {
          type: "paragraph",
          text: "Failure to submit a refund request within the stated timeline may constitute acceptance of the revised event date.",
        },
      ],
    },
    {
      id: "submission",
      title: "6. Refund request submission process",
      blocks: [
        {
          type: "paragraph",
          text: "6.1 Refund requests must be submitted through the All AXS customer portal, official customer support channels, or the automated refund request system available on the platform.",
        },
        {
          type: "paragraph",
          text: "6.2 Users may be required to provide: ticket reference number; proof of purchase; registered email or phone number; reason for refund request; and supporting documentation where applicable.",
        },
        {
          type: "paragraph",
          text: "6.3 All refund requests are subject to transaction verification, fraud prevention review, and organizer approval where required. Incomplete or inaccurate submissions may delay processing.",
        },
      ],
    },
    {
      id: "timelines",
      title: "7. Processing timelines and communication",
      blocks: [
        {
          type: "paragraph",
          text: "7.1 Approved refunds are generally processed within 7–14 business days for mobile money transactions and 7–21 business days for bank card or bank transfer refunds. Actual timelines may vary depending on payment providers and financial institutions.",
        },
        {
          type: "paragraph",
          text: "7.2 Users shall receive refund updates through email notifications, SMS alerts, platform account notifications, and customer support communication channels.",
        },
      ],
    },
    {
      id: "non-refundable-fees",
      title: "8. Non-refundable fees",
      blocks: [
        {
          type: "paragraph",
          text: "The following fees may be non-refundable: platform service fees; payment gateway charges; convenience fees; currency conversion fees; and third-party transaction charges. These fees may be deducted before processing refunds.",
        },
      ],
    },
    {
      id: "partial-refunds",
      title: "9. Partial refund scenarios",
      blocks: [
        {
          type: "paragraph",
          text: "Partial refunds may apply in circumstances including downgraded ticket categories, venue changes, reduced event access, multi-day event cancellations affecting only part of the event, or organizer-approved goodwill compensation. All AXS reserves the right to determine applicable deductions and administrative charges.",
        },
      ],
    },
    {
      id: "fraud",
      title: "10. Fraudulent transactions and investigations",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS reserves the right to investigate transactions suspected of fraudulent activity, unauthorized payment use, chargeback abuse, ticket duplication or scalping, or identity misrepresentation. Refunds may be delayed, withheld, or denied pending investigation. Users may be required to provide identification, proof of payment, or additional verification documentation. Fraudulent conduct may result in account suspension, ticket cancellation, permanent platform bans, or reporting to law enforcement authorities.",
        },
      ],
    },
    {
      id: "chargebacks",
      title: "11. Chargeback handling process",
      blocks: [
        {
          type: "paragraph",
          text: "Users are encouraged to contact All AXS customer support before initiating chargebacks with financial institutions. Where a chargeback is initiated, the transaction may be temporarily suspended for review; access to tickets or platform services may be restricted; supporting evidence may be submitted to payment providers; and fraud investigations may be initiated where abuse is suspected. Improper or fraudulent chargebacks may result in account suspension or legal action.",
        },
      ],
    },
    {
      id: "organizer-exceptions",
      title: "12. Organizer-approved refund exceptions",
      blocks: [
        {
          type: "paragraph",
          text: "Event organizers may approve exceptions to this Policy in special circumstances, including medical emergencies, verified bereavement, venue safety concerns, or event-specific customer service resolutions. Organizer-approved exceptions remain subject to platform review, administrative deductions, and verification procedures.",
        },
      ],
    },
    {
      id: "automation",
      title: "13. Automated refund and approval workflow",
      blocks: [
        {
          type: "paragraph",
          text: "To improve efficiency and transparency, All AXS may implement automated refund request submission tools, refund status tracking dashboards, automated approval workflows for qualifying cases, organizer review portals, and notification systems for refund updates and approvals.",
        },
      ],
    },
    {
      id: "support",
      title: "14. Customer support and escalation process",
      blocks: [
        {
          type: "paragraph",
          text: "Users requiring assistance may contact All AXS customer support through official communication channels. Escalation levels include first-level support (general refund inquiries), second-level review (disputes and verification), finance review (payment reconciliation), and legal or compliance review (fraud, disputes, or regulatory matters). All escalation decisions shall be communicated through official channels.",
        },
      ],
    },
    {
      id: "acknowledgment",
      title: "15. Terms acknowledgment before payment",
      blocks: [
        {
          type: "paragraph",
          text: "By completing a ticket purchase, users acknowledge and agree that they have reviewed this Refund and Cancellation Policy; refunds are subject to eligibility and approval requirements; administrative and processing deductions may apply; and event-specific policies may override standard refund terms. A confirmation checkbox or acknowledgment mechanism may be required before payment completion.",
        },
      ],
    },
    {
      id: "internal",
      title: "16. Internal operational procedures",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS shall maintain internal Standard Operating Procedures (SOPs) for refund approvals and escalations, financial reconciliation and payout adjustments, fraud detection and prevention, customer support handling, audit reporting and compliance reviews, and organizer communication and dispute management. Internal procedures may be updated periodically.",
        },
      ],
    },
    {
      id: "amendments",
      title: "17. Amendments to this policy",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS reserves the right to modify or update this Policy at any time. Updated versions shall become effective upon publication on the platform. Continued use of the platform constitutes acceptance of the revised Policy.",
        },
      ],
    },
  ],
};

export const PAYOUT_POLICY: LegalDocument = {
  slug: "payout-policy",
  title: "Organizer payout & financial settlement policy",
  description:
    "Financial settlements, payouts, and reconciliations between All AXS Africa and event organizers.",
  eyebrow: "Legal",
  sections: [
    {
      id: "introduction",
      title: "1. Introduction",
      blocks: [
        {
          type: "paragraph",
          text: "This Organizer Payout and Financial Settlement Policy (“Policy”) governs all financial settlements, payouts, reconciliations, and related financial operations between All AXS Africa (“All AXS”, “we”, “our”, or “us”) and event organizers using the All AXS ticketing and events platform.",
        },
        {
          type: "paragraph",
          text: "By listing or selling tickets through the platform, event organizers agree to comply with this Policy, the platform Terms and Conditions, applicable laws of Kenya, and any related financial or compliance requirements. This Policy is intended to promote transparency, accountability, financial integrity, and timely settlement of funds.",
        },
      ],
    },
    {
      id: "schedule",
      title: "2. Organizer payout schedule options",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS may provide organizers with one or more payout schedule options depending on organizer profile, event risk level, transaction history, and compliance status.",
        },
        {
          type: "paragraph",
          text: "Available payout structures may include post-event payouts, partial advance payouts, milestone-based payouts, scheduled weekly or bi-weekly settlements, and rolling reserve payout structures for high-risk events.",
        },
        {
          type: "paragraph",
          text: "Standard payout model — unless otherwise agreed in writing: organizer payouts shall be processed after successful completion of the event; funds may be released after deduction of applicable fees, refunds, chargebacks, taxes, and reserves. All payout schedules remain subject to internal risk, compliance, and finance approval.",
        },
      ],
    },
    {
      id: "timelines",
      title: "3. Standard payout processing timelines",
      blocks: [
        {
          type: "paragraph",
          text: "Approved organizer payouts are generally processed within 5–10 business days after the event date for local payouts, and 7–21 business days for international transfers.",
        },
        {
          type: "paragraph",
          text: "Processing timelines may vary depending on banking institutions, payment providers, verification reviews, public holidays, and regulatory requirements. All AXS shall make reasonable efforts to communicate any expected delays.",
        },
      ],
    },
    {
      id: "commission",
      title: "4. Commission structure and deductions",
      blocks: [
        {
          type: "paragraph",
          text: "All organizer payouts are subject to applicable deductions including but not limited to: platform commission fees; payment gateway transaction charges; currency conversion fees; refund deductions; chargeback deductions; applicable taxes or statutory obligations; and marketing or promotional service costs where applicable.",
        },
        {
          type: "paragraph",
          text: "Detailed fee structures may be disclosed in organizer onboarding agreements, event contracts, or platform pricing schedules. All deductions shall be reflected in organizer settlement reports.",
        },
      ],
    },
    {
      id: "thresholds",
      title: "5. Minimum payout thresholds",
      blocks: [
        {
          type: "paragraph",
          text: "Organizers may be required to meet minimum payout thresholds before funds are released. Minimum payout values may vary by payment method or country; balances below the minimum threshold may be carried forward to the next settlement cycle. All AXS reserves the right to revise payout thresholds with prior notice.",
        },
      ],
    },
    {
      id: "bank-verification",
      title: "6. Bank account verification requirements",
      blocks: [
        {
          type: "paragraph",
          text: "Before receiving payouts, organizers must provide valid banking or payment account information, submit required identification and verification documents, complete Know Your Customer (KYC) verification procedures, and ensure account ownership matches organizer registration details.",
        },
        {
          type: "paragraph",
          text: "All AXS reserves the right to reject unverifiable accounts, request additional documentation, or suspend payouts pending verification. Incorrect banking details provided by organizers may result in delayed settlements.",
        },
      ],
    },
    {
      id: "mobile-money",
      title: "7. Mobile money payout options",
      blocks: [
        {
          type: "paragraph",
          text: "Where supported, organizers may receive payouts through approved mobile money services. Mobile money payout limits may apply; organizers are responsible for ensuring accurate mobile wallet information; transaction fees charged by mobile operators may be deducted; and availability may depend on jurisdiction and provider support. All AXS reserves the right to limit payout methods based on operational or regulatory requirements.",
        },
      ],
    },
    {
      id: "tax",
      title: "8. Tax withholding and statutory deductions",
      blocks: [
        {
          type: "paragraph",
          text: "Organizers are solely responsible for tax reporting obligations, VAT compliance, income tax declarations, and applicable licensing or statutory obligations. Where legally required, All AXS may withhold taxes, deduct statutory charges, or submit financial reporting to regulatory authorities in compliance with Kenyan laws and applicable international regulations.",
        },
      ],
    },
    {
      id: "currency",
      title: "9. Currency conversion and international transfers",
      blocks: [
        {
          type: "paragraph",
          text: "For international organizers or foreign currency settlements: currency conversion rates shall be determined by banking or payment partners; exchange rate fluctuations may affect final payout values; international wire or transfer fees may apply; and organizers are responsible for ensuring compliance with local financial regulations in their jurisdictions. All AXS shall not be liable for losses resulting from currency fluctuations or intermediary banking charges.",
        },
      ],
    },
    {
      id: "fraud-hold",
      title: "10. Fraud review and payout hold procedures",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS reserves the right to review transactions and temporarily withhold payouts where there are concerns relating to fraudulent ticket sales, suspicious transaction activity, excessive refund or chargeback requests, regulatory investigations, event cancellation risks, or identity verification failures.",
        },
        {
          type: "paragraph",
          text: "During review, organizers may be requested to provide additional documentation; payouts may be partially or fully suspended; and reserve balances may be retained pending investigation outcomes. Failure to cooperate with investigations may result in permanent suspension from the platform.",
        },
      ],
    },
    {
      id: "disputes",
      title: "11. Dispute resolution and reconciliation process",
      blocks: [
        {
          type: "paragraph",
          text: "Organizers may dispute payout calculations or deductions by submitting a formal reconciliation request through official support channels. Reconciliation requests must include event reference details, transaction records, specific disputed amounts, and supporting documentation.",
        },
        {
          type: "paragraph",
          text: "All AXS shall conduct internal review and reconciliation, provide settlement statements, and communicate findings within a reasonable timeframe. Disputes not resolved amicably may be escalated in accordance with the platform dispute resolution procedures.",
        },
      ],
    },
    {
      id: "force-majeure",
      title: "12. Delayed payouts and force majeure",
      blocks: [
        {
          type: "paragraph",
          text: "Payouts may be delayed due to banking disruptions, regulatory restrictions, technical failures, payment processor delays, fraud investigations, or force majeure events including natural disasters, government actions, civil unrest, internet or telecommunications failures, public health emergencies, or acts beyond reasonable operational control. All AXS shall not be held liable for payout delays caused by force majeure circumstances.",
        },
      ],
    },
    {
      id: "reporting",
      title: "13. Organizer invoicing and financial reporting obligations",
      blocks: [
        {
          type: "paragraph",
          text: "Organizers may be required to issue invoices where applicable, maintain accurate financial records, provide supporting documentation for reconciliation, and comply with audit and tax reporting requirements.",
        },
        {
          type: "paragraph",
          text: "All AXS may provide settlement summaries, financial transaction reports, downloadable payout statements, and event sales analytics dashboards. Organizers are responsible for maintaining independent accounting records.",
        },
      ],
    },
    {
      id: "chargebacks",
      title: "14. Chargeback and refund deduction handling",
      blocks: [
        {
          type: "paragraph",
          text: "Refunds and chargebacks processed after ticket sales may be deducted from organizer payouts. Deductible amounts may include refunded ticket values, payment processing fees, chargeback penalties, administrative costs, and fraud investigation costs.",
        },
        {
          type: "paragraph",
          text: "Where organizer balances become negative, future payouts may be offset, additional settlement obligations may arise, and collections or legal recovery actions may be initiated where necessary.",
        },
      ],
    },
    {
      id: "kyc",
      title: "15. Compliance and KYC verification requirements",
      blocks: [
        {
          type: "paragraph",
          text: "To comply with anti-money laundering, financial compliance, and fraud prevention requirements, organizers may be required to provide government-issued identification, business registration documents, tax certificates, proof of address, banking verification documentation, and beneficial ownership details.",
        },
        {
          type: "paragraph",
          text: "All AXS reserves the right to reject incomplete submissions, conduct enhanced due diligence reviews, or suspend accounts for non-compliance.",
        },
      ],
    },
    {
      id: "automation",
      title: "16. Automated payout and financial workflow systems",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS may implement automated systems including organizer payout request portals, automated settlement dashboards, real-time payout tracking tools, financial reconciliation systems, approval workflow management tools, and notification systems for payout status updates. Use of automated systems does not waive manual compliance or finance review requirements.",
        },
      ],
    },
    {
      id: "internal",
      title: "17. Internal finance and operational procedures",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS shall maintain internal Standard Operating Procedures (SOPs) governing payout approvals, financial reconciliation, refund and chargeback adjustments, fraud investigation procedures, escalation and dispute handling, audit reporting, compliance verification, and risk management controls. Internal procedures may be revised periodically.",
        },
      ],
    },
    {
      id: "audit",
      title: "18. Audit and transaction reporting framework",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS reserves the right to conduct transaction audits, review organizer financial activity, monitor compliance with platform policies, and generate regulatory and financial reports. Organizers agree to cooperate with reasonable audit or compliance requests where required.",
        },
      ],
    },
    {
      id: "amendments",
      title: "19. Amendments to this policy",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS reserves the right to modify or update this Policy at any time. Updated versions shall become effective immediately upon publication on the platform unless otherwise stated. Continued use of the platform constitutes acceptance of the revised Policy.",
        },
      ],
    },
    {
      id: "law",
      title: "20. Governing law",
      blocks: [
        {
          type: "paragraph",
          text: "This Policy shall be governed and interpreted in accordance with the laws of the Republic of Kenya.",
        },
      ],
    },
  ],
};

/** Privacy summary derived from Terms §5 — no separate counsel PDF was provided. */
export const PRIVACY_POLICY: LegalDocument = {
  slug: "privacy",
  title: "Privacy policy",
  description: "How All AXS Africa collects, uses, and protects personal information.",
  eyebrow: "Legal",
  sections: [
    {
      id: "introduction",
      title: "Introduction",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS Africa (“All AXS”, “we”, “our”, or “us”) respects your privacy. This Privacy Policy explains how we collect, use, store, and protect personal information when you use our ticketing and events platform. It should be read together with our Terms and Conditions.",
        },
      ],
    },
    {
      id: "collection",
      title: "Information we collect",
      blocks: [
        {
          type: "paragraph",
          text: "We may collect the following categories of information:",
        },
        {
          type: "list",
          items: [
            "Account information — name, email address, phone number, and password credentials;",
            "Purchase and ticketing data — order history, ticket details, payment references, and check-in status;",
            "Organizer profile data — legal name, business details, payout and banking information, tax references, and verification documents submitted during onboarding;",
            "Device and usage data — browser type, IP address, pages visited, and interaction logs for security and analytics;",
            "Communications — support messages, refund requests, and notification preferences.",
          ],
        },
      ],
    },
    {
      id: "use",
      title: "How we use your information",
      blocks: [
        {
          type: "list",
          items: [
            "Processing ticket purchases, payments, refunds, and payouts;",
            "Delivering tickets, receipts, and event-related communications (email, SMS, or WhatsApp where opted in);",
            "Operating door scanning, check-in, and fraud prevention systems;",
            "Verifying identity and compliance (including KYC for organizers);",
            "Improving platform performance, security, and customer support;",
            "Sending marketing communications where you have provided consent (you may opt out at any time).",
          ],
        },
      ],
    },
    {
      id: "legal-basis",
      title: "Legal basis and consent",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS collects and processes personal information in accordance with applicable data protection laws, including the Kenya Data Protection Act, 2019. By using the platform, you consent to the collection, storage, and processing of your information for ticketing, communication, security, and operational purposes. Users may be required to provide identification or verification information for compliance and fraud prevention purposes.",
        },
      ],
    },
    {
      id: "sharing",
      title: "Who we share information with",
      blocks: [
        {
          type: "paragraph",
          text: "We may share personal information with:",
        },
        {
          type: "list",
          items: [
            "Payment processors (e.g. Paystack) to complete transactions and refunds;",
            "Email and messaging providers (e.g. Resend, Twilio) to deliver tickets and notifications;",
            "Event organizers — buyer name, email, and ticket tier for events they host;",
            "Regulatory or law enforcement authorities where required by law;",
            "Service providers who assist us under confidentiality obligations.",
          ],
        },
        {
          type: "paragraph",
          text: "We do not sell personal information to third parties.",
        },
      ],
    },
    {
      id: "retention",
      title: "Data retention",
      blocks: [
        {
          type: "paragraph",
          text: "We retain personal information for as long as necessary to provide services, comply with legal and financial obligations (including tax and audit requirements), resolve disputes, and enforce our agreements. Transaction records may be retained for the period required by applicable law.",
        },
      ],
    },
    {
      id: "security",
      title: "Security",
      blocks: [
        {
          type: "paragraph",
          text: "All AXS implements reasonable technical and organizational measures to protect user data from unauthorized access, loss, or misuse. No method of transmission over the internet is completely secure; we encourage users to protect account credentials and report suspicious activity promptly.",
        },
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      blocks: [
        {
          type: "paragraph",
          text: "Subject to applicable law, you may have the right to access, correct, or delete your personal information, object to or restrict certain processing, and withdraw consent for marketing communications. To exercise these rights, contact us using the details below.",
        },
      ],
    },
    {
      id: "contact",
      title: "Contact us",
      blocks: [
        {
          type: "paragraph",
          text: `For privacy-related inquiries or data subject requests, contact All AXS Africa at ${PLATFORM_SUPPORT_EMAIL}.`,
        },
      ],
    },
    {
      id: "amendments",
      title: "Changes to this policy",
      blocks: [
        {
          type: "paragraph",
          text: "We may update this Privacy Policy from time to time. Updated versions will be published on this page. Continued use of the platform after changes constitutes acceptance of the revised policy.",
        },
      ],
    },
  ],
};

export const LEGAL_DOCUMENTS: Record<string, LegalDocument> = {
  terms: TERMS_AND_CONDITIONS,
  privacy: PRIVACY_POLICY,
  "refund-policy": REFUND_POLICY,
  "payout-policy": PAYOUT_POLICY,
};
