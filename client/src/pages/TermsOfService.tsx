import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function TermsOfService() {
  const lastUpdated = "December 2, 2024";
  const companyName = "Olympic Auto Group";
  const companyEmail = "legal@olympicautogroup.ca";
  const websiteUrl = "https://olympicautogroup.ca";

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="mb-6">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="back-to-home">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="prose dark:prose-invert max-w-none p-8">
            <h1 className="text-3xl font-bold mb-2" data-testid="terms-title">Terms of Service</h1>
            <p className="text-muted-foreground mb-6">Last Updated: {lastUpdated}</p>
            
            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p className="mb-4">
                Welcome to {companyName} ("Company," "we," "us," or "our"). These Terms of Service ("Terms") govern your access to and use of our vehicle inventory management platform, website, and related services (collectively, the "Service").
              </p>
              <p className="mb-4">
                <strong>BY ACCESSING OR USING THE SERVICE, YOU AGREE TO BE BOUND BY THESE TERMS.</strong> If you do not agree to these Terms, you must not access or use the Service.
              </p>
              <p className="mb-4">
                These Terms apply to all visitors, users, customers, and dealership partners who access or use the Service. For dealership partners ("Subscribers"), these Terms form part of your subscription agreement.
              </p>
              <p className="mb-4">
                <strong>Age Requirement:</strong> You must be at least 18 years old and have the legal capacity to enter into binding contracts to use this Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
              <p className="mb-4">
                {companyName} provides a cloud-based Software-as-a-Service (SaaS) vehicle inventory management and marketing platform designed for automotive dealerships. Our Service includes:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Vehicle inventory listing and management</li>
                <li>Customer browsing and vehicle search functionality</li>
                <li>Financing calculator and payment estimation tools</li>
                <li>Integration with third-party advertising platforms (including Meta/Facebook)</li>
                <li>AI-powered vehicle descriptions and chat assistance</li>
                <li>Analytics, reporting, and market intelligence tools</li>
                <li>Multi-location dealership management</li>
                <li>Customer lead management and CRM features</li>
              </ul>
              <p className="mb-4">
                The Service is intended solely for lawful business purposes related to automotive retail and marketing.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. User Accounts</h2>
              
              <h3 className="text-lg font-medium mb-3">3.1 Account Registration</h3>
              <p className="mb-4">
                To access certain features, you must create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Provide accurate, current, and complete registration information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security and confidentiality of your password</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized access or security breach</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">3.2 Account Types and Roles</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Customer Accounts:</strong> For browsing inventory and making inquiries</li>
                <li><strong>Sales Staff Accounts:</strong> For managing customer interactions and leads</li>
                <li><strong>Manager Accounts:</strong> For dealership-level administration, analytics, and reporting</li>
                <li><strong>Admin Accounts:</strong> For system configuration, user management, and integrations</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">3.3 Account Security</h3>
              <p className="mb-4">
                You are responsible for all activities that occur under your account. We recommend using strong, unique passwords and enabling two-factor authentication where available. We may suspend accounts showing suspicious or potentially harmful activity.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. Subscription Terms (Dealership Partners)</h2>
              
              <h3 className="text-lg font-medium mb-3">4.1 Subscription Plans</h3>
              <p className="mb-4">
                Dealership partners subscribe to our Service under one of the following plan types, as specified in your Order Form or subscription agreement:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Starter:</strong> Single location, basic features</li>
                <li><strong>Professional:</strong> Multi-location support, advanced analytics</li>
                <li><strong>Enterprise:</strong> Custom features, dedicated support, SLA guarantees</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">4.2 Subscription Term</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Initial Term:</strong> As specified in your Order Form (typically 12 months)</li>
                <li><strong>Renewal:</strong> Subscriptions automatically renew for successive terms of equal length unless cancelled at least 30 days before the renewal date</li>
                <li><strong>Price Changes:</strong> We will provide at least 60 days written notice of any price increases before your renewal date</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">4.3 Data Ownership</h3>
              <p className="mb-4">
                <strong>You retain full ownership of all vehicle inventory data, customer information, and business records you upload to the Service.</strong> We process this data solely to provide the Service and do not claim ownership of your content.
              </p>

              <h3 className="text-lg font-medium mb-3">4.4 License Grant to Us</h3>
              <p className="mb-4">
                By uploading content to the Service, you grant us a non-exclusive, royalty-free, worldwide license to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Display your vehicle listings to potential customers on our platform</li>
                <li>Syndicate listings to third-party advertising platforms you authorize</li>
                <li>Create backups and maintain system integrity</li>
                <li>Use aggregated, anonymized data for analytics and service improvement</li>
              </ul>
              <p className="mb-4">
                This license terminates when you remove content from the Service, except for archival copies required for legal compliance.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Fees and Payment</h2>
              
              <h3 className="text-lg font-medium mb-3">5.1 Subscription Fees</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Fees are as specified in your Order Form or subscription agreement</li>
                <li>Subscriptions are billed in advance on a monthly or annual basis</li>
                <li>All fees are non-refundable except as expressly stated in these Terms</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">5.2 Payment Terms</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>All fees are in Canadian Dollars (CAD) unless otherwise specified</li>
                <li>Payment is due within 30 days of invoice date</li>
                <li>We accept major credit cards, ACH/EFT transfers, and wire transfers</li>
                <li>Late payments may incur interest at 1.5% per month (18% annually) or the maximum rate permitted by law</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">5.3 Suspension for Non-Payment</h3>
              <p className="mb-4">
                If payment is not received within 10 days after a reminder notice:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>We may suspend your access to the Service</li>
                <li>Your vehicle listings may be removed from public display</li>
                <li>Third-party integrations may be deactivated</li>
              </ul>
              <p className="mb-4">
                Service will be restored promptly upon receipt of all outstanding payments.
              </p>

              <h3 className="text-lg font-medium mb-3">5.4 Taxes</h3>
              <p className="mb-4">
                All fees exclude applicable taxes (GST, HST, PST, provincial sales taxes). You are responsible for all taxes related to your use of the Service. We will add applicable taxes to invoices.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Service Level Agreement (SLA)</h2>
              
              <h3 className="text-lg font-medium mb-3">6.1 Uptime Commitment</h3>
              <p className="mb-4">
                We commit to the following availability targets for paid subscriptions:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Starter & Professional Plans:</strong> 99.5% monthly uptime</li>
                <li><strong>Enterprise Plans:</strong> 99.9% monthly uptime (with custom SLA)</li>
              </ul>
              <p className="mb-4">
                <strong>Uptime Calculation:</strong> ((Total Minutes in Month - Downtime Minutes) / Total Minutes in Month) × 100
              </p>

              <h3 className="text-lg font-medium mb-3">6.2 Exclusions from Uptime Calculation</h3>
              <p className="mb-4">Downtime does not include:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Scheduled maintenance (with at least 24 hours advance notice)</li>
                <li>Emergency maintenance required for security or stability</li>
                <li>Outages caused by factors outside our control (ISP failures, DNS issues, DDoS attacks)</li>
                <li>Third-party service unavailability (Meta, payment processors, etc.)</li>
                <li>Customer-caused issues (misconfiguration, excessive API usage)</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">6.3 Service Credits</h3>
              <p className="mb-4">
                If we fail to meet our uptime commitment, you may be eligible for service credits:
              </p>
              <table className="w-full border-collapse mb-4">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Monthly Uptime</th>
                    <th className="text-left p-2">Service Credit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2">99.0% - 99.5%</td>
                    <td className="p-2">10% of monthly fee</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">95.0% - 99.0%</td>
                    <td className="p-2">25% of monthly fee</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Below 95.0%</td>
                    <td className="p-2">50% of monthly fee</td>
                  </tr>
                </tbody>
              </table>
              <p className="mb-4">
                Credits must be requested within 30 days of the incident. Maximum credit per month is 50% of monthly fees.
              </p>

              <h3 className="text-lg font-medium mb-3">6.4 Support Response Times</h3>
              <table className="w-full border-collapse mb-4">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Severity</th>
                    <th className="text-left p-2">Definition</th>
                    <th className="text-left p-2">Response Target</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-2">Critical</td>
                    <td className="p-2">Service completely unavailable</td>
                    <td className="p-2">1 hour</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">High</td>
                    <td className="p-2">Major feature impaired</td>
                    <td className="p-2">4 hours</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Medium</td>
                    <td className="p-2">Minor feature issue</td>
                    <td className="p-2">1 business day</td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-2">Low</td>
                    <td className="p-2">Question or enhancement request</td>
                    <td className="p-2">2 business days</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Dealership Partner Responsibilities</h2>
              <p className="mb-4">Dealership partners agree to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Accurate Information:</strong> Provide accurate vehicle information (VIN, mileage, condition, pricing)</li>
                <li><strong>Legal Compliance:</strong> Comply with all applicable consumer protection, advertising, and privacy laws</li>
                <li><strong>Licensing:</strong> Maintain valid dealer licenses and business registrations</li>
                <li><strong>Responsiveness:</strong> Respond to customer inquiries in a timely manner (within 24 hours recommended)</li>
                <li><strong>Inventory Accuracy:</strong> Remove sold or unavailable vehicles promptly (within 24 hours)</li>
                <li><strong>Data Protection:</strong> Protect customer data in accordance with applicable privacy laws</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">8. Acceptable Use Policy</h2>
              <p className="mb-4">You agree NOT to use the Service to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>List vehicles you do not own or have authority to sell</li>
                <li>Provide false, misleading, or deceptive information</li>
                <li>Engage in fraudulent pricing practices (bait-and-switch, hidden fees)</li>
                <li>Violate any applicable laws, regulations, or third-party rights</li>
                <li>Infringe on intellectual property rights</li>
                <li>Upload malware, viruses, or harmful code</li>
                <li>Attempt to gain unauthorized access to systems or data</li>
                <li>Scrape, harvest, or collect data without authorization</li>
                <li>Interfere with the proper functioning of the Service</li>
                <li>Harass, abuse, or threaten other users</li>
                <li>Use the Service to build a competing product</li>
                <li>Resell or redistribute access to the Service without authorization</li>
              </ul>
              <p className="mb-4">
                Violation of this Acceptable Use Policy may result in immediate suspension or termination of your account.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">9. Third-Party Integrations</h2>
              
              <h3 className="text-lg font-medium mb-3">9.1 Meta/Facebook Integration</h3>
              <p className="mb-4">
                Our Service integrates with Meta platforms (Facebook, Instagram) for advertising purposes. By enabling these integrations, you agree to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Meta's Terms of Service and Commerce Policies</li>
                <li>Automotive Inventory Ads requirements and specifications</li>
                <li>Data sharing as described in our Privacy Policy</li>
              </ul>
              <p className="mb-4">
                You are responsible for obtaining any necessary consents from your customers before their data is shared with Meta.
              </p>

              <h3 className="text-lg font-medium mb-3">9.2 Other Third-Party Services</h3>
              <p className="mb-4">
                The Service may integrate with payment processors, VIN decoders, market data providers, and other third-party services. Your use of these services is subject to their respective terms and conditions.
              </p>
              <p className="mb-4">
                <strong>Disclaimer:</strong> We are not responsible for third-party service availability, performance, or data practices. Third-party services may change or discontinue without notice.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">10. Intellectual Property</h2>
              
              <h3 className="text-lg font-medium mb-3">10.1 Our Intellectual Property</h3>
              <p className="mb-4">
                The Service, including its design, features, functionality, software, algorithms, and content (excluding user-provided content), is owned by {companyName} and protected by copyright, trademark, and other intellectual property laws.
              </p>

              <h3 className="text-lg font-medium mb-3">10.2 Limited License</h3>
              <p className="mb-4">
                We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your internal business purposes during your subscription term.
              </p>

              <h3 className="text-lg font-medium mb-3">10.3 Restrictions</h3>
              <p className="mb-4">You may not:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Copy, modify, or distribute our software or content</li>
                <li>Reverse engineer, decompile, or disassemble the Service</li>
                <li>Remove any proprietary notices or labels</li>
                <li>Sublicense, resell, or redistribute access to the Service</li>
                <li>Use our trademarks without written permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">11. Disclaimer of Warranties</h2>
              <p className="mb-4 font-semibold">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>WARRANTIES OF MERCHANTABILITY</li>
                <li>FITNESS FOR A PARTICULAR PURPOSE</li>
                <li>NON-INFRINGEMENT</li>
                <li>ACCURACY OR COMPLETENESS OF CONTENT</li>
                <li>UNINTERRUPTED OR ERROR-FREE OPERATION</li>
              </ul>
              <p className="mb-4">
                We do not warrant that the Service will meet your specific requirements, that results will be accurate or reliable, or that defects will be corrected. We are not responsible for the accuracy of vehicle listings, third-party data, or market information.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">12. Limitation of Liability</h2>
              
              <h3 className="text-lg font-medium mb-3">12.1 Liability Cap</h3>
              <p className="mb-4 font-semibold">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>THE FEES PAID BY YOU IN THE 12 MONTHS IMMEDIATELY PRECEDING THE CLAIM, OR</li>
                <li>ONE HUNDRED CANADIAN DOLLARS ($100 CAD)</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">12.2 Exclusion of Damages</h3>
              <p className="mb-4 font-semibold">
                WE ARE NOT LIABLE FOR:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES</li>
                <li>LOST PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITIES</li>
                <li>COST OF SUBSTITUTE SERVICES</li>
                <li>LOSS OF GOODWILL OR REPUTATION</li>
                <li>ACTIONS OF THIRD PARTIES, OTHER USERS, OR CUSTOMERS</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">12.3 Exceptions</h3>
              <p className="mb-4">
                These limitations do not apply to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Death or personal injury caused by our negligence</li>
                <li>Fraud or fraudulent misrepresentation</li>
                <li>Any liability that cannot be excluded by law</li>
              </ul>
              <p className="mb-4">
                Some jurisdictions do not allow limitation of liability for certain damages. In such cases, our liability is limited to the maximum extent permitted by applicable law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">13. Indemnification</h2>
              <p className="mb-4">
                You agree to indemnify, defend, and hold harmless {companyName}, its officers, directors, employees, agents, licensors, and service providers from any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising from:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms or any applicable law</li>
                <li>Your violation of any third-party rights (including intellectual property)</li>
                <li>Any content you upload, post, or transmit</li>
                <li>Any vehicle transaction disputes with customers</li>
                <li>Your failure to comply with consumer protection or advertising laws</li>
              </ul>
              <p className="mb-4">
                We will provide notice of any claim and cooperate in the defense. You may not settle any claim without our prior written consent.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">14. Termination</h2>
              
              <h3 className="text-lg font-medium mb-3">14.1 Termination by You</h3>
              <p className="mb-4">
                You may terminate your subscription at any time by providing written notice to us. Termination is effective:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Monthly Plans:</strong> At the end of the current billing month</li>
                <li><strong>Annual Plans:</strong> At the end of the current annual term</li>
              </ul>
              <p className="mb-4">
                <strong>No Refunds:</strong> Fees paid are non-refundable, and you remain responsible for fees through the end of your current term.
              </p>

              <h3 className="text-lg font-medium mb-3">14.2 Termination by Us</h3>
              <p className="mb-4">We may suspend or terminate your access immediately if:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>You materially breach these Terms</li>
                <li>You fail to pay fees when due (after 10-day notice)</li>
                <li>Your account shows fraudulent, illegal, or harmful activity</li>
                <li>Required by law, court order, or government authority</li>
                <li>We discontinue the Service (with 90 days advance notice)</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">14.3 Effect of Termination</h3>
              <p className="mb-4">Upon termination:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Your access to the Service immediately ceases</li>
                <li><strong>Data Export:</strong> You have 30 days to export your data in a standard format</li>
                <li><strong>Data Deletion:</strong> After 30 days, we may permanently delete your data</li>
                <li><strong>Survival:</strong> Sections regarding payment obligations, intellectual property, indemnification, limitation of liability, and dispute resolution survive termination</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">14.4 Refund Policy</h3>
              <p className="mb-4">
                Refunds are available only in the following circumstances:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>New Subscribers:</strong> Full refund if cancelled within 14 days of initial subscription (for annual plans)</li>
                <li><strong>Service Credits:</strong> As specified in the SLA for uptime failures</li>
                <li><strong>Service Discontinuation:</strong> Pro-rata refund if we discontinue the Service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">15. Modifications</h2>
              
              <h3 className="text-lg font-medium mb-3">15.1 Modifications to Terms</h3>
              <p className="mb-4">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Posting the updated Terms on our website</li>
                <li>Updating the "Last Updated" date</li>
                <li>Sending email notification for material changes (at least 30 days in advance)</li>
              </ul>
              <p className="mb-4">
                Continued use of the Service after changes become effective constitutes acceptance. If you do not agree to the changes, you may terminate your subscription.
              </p>

              <h3 className="text-lg font-medium mb-3">15.2 Modifications to Service</h3>
              <p className="mb-4">
                We may modify, add, or discontinue features at any time. For material changes that reduce functionality, we will provide 30 days advance notice to paid subscribers.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">16. Dispute Resolution</h2>
              
              <h3 className="text-lg font-medium mb-3">16.1 Governing Law</h3>
              <p className="mb-4">
                These Terms are governed by and construed in accordance with the laws of the Province of British Columbia, Canada, without regard to conflict of law principles.
              </p>

              <h3 className="text-lg font-medium mb-3">16.2 Informal Resolution</h3>
              <p className="mb-4">
                Before initiating formal proceedings, you agree to contact us and attempt to resolve the dispute informally for at least 30 days. Most disputes can be resolved through good-faith negotiation.
              </p>

              <h3 className="text-lg font-medium mb-3">16.3 Mediation</h3>
              <p className="mb-4">
                If informal resolution fails, either party may initiate non-binding mediation before a mutually agreed mediator in Vancouver, British Columbia. Each party bears their own mediation costs; mediator fees are split equally.
              </p>

              <h3 className="text-lg font-medium mb-3">16.4 Jurisdiction and Venue</h3>
              <p className="mb-4">
                If mediation fails, any legal action arising from these Terms shall be brought exclusively in the courts of British Columbia, Canada. You consent to the personal jurisdiction of such courts.
              </p>

              <h3 className="text-lg font-medium mb-3">16.5 Class Action Waiver</h3>
              <p className="mb-4">
                To the extent permitted by law, you agree to resolve disputes individually and waive the right to participate in class actions, class arbitrations, or representative proceedings.
              </p>

              <h3 className="text-lg font-medium mb-3">16.6 Time Limitation</h3>
              <p className="mb-4">
                Any claim arising from these Terms or the Service must be brought within one (1) year of the date the claim arose, or it is permanently barred.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">17. General Provisions</h2>
              
              <h3 className="text-lg font-medium mb-3">17.1 Entire Agreement</h3>
              <p className="mb-4">
                These Terms, together with our Privacy Policy and any Order Form, constitute the entire agreement between you and {companyName} regarding the Service and supersede all prior agreements.
              </p>

              <h3 className="text-lg font-medium mb-3">17.2 Severability</h3>
              <p className="mb-4">
                If any provision of these Terms is found unenforceable, that provision will be modified to the minimum extent necessary, and the remaining provisions will remain in full force and effect.
              </p>

              <h3 className="text-lg font-medium mb-3">17.3 Waiver</h3>
              <p className="mb-4">
                Our failure to enforce any right or provision of these Terms does not constitute a waiver of that right. Any waiver must be in writing and signed by us.
              </p>

              <h3 className="text-lg font-medium mb-3">17.4 Assignment</h3>
              <p className="mb-4">
                You may not assign or transfer these Terms without our prior written consent. We may assign our rights and obligations to an affiliate or in connection with a merger, acquisition, or sale of assets.
              </p>

              <h3 className="text-lg font-medium mb-3">17.5 Force Majeure</h3>
              <p className="mb-4">
                Neither party is liable for delays or failures due to circumstances beyond reasonable control (natural disasters, war, terrorism, government actions, internet outages, pandemic, etc.).
              </p>

              <h3 className="text-lg font-medium mb-3">17.6 Notices</h3>
              <p className="mb-4">
                We may provide notices by email, in-app notification, or posting on our website. Notices to us must be sent to {companyEmail} and are effective upon receipt.
              </p>

              <h3 className="text-lg font-medium mb-3">17.7 Relationship of Parties</h3>
              <p className="mb-4">
                The parties are independent contractors. Nothing in these Terms creates a partnership, joint venture, agency, or employment relationship.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">18. Contact Information</h2>
              <p className="mb-4">
                For questions about these Terms of Service, please contact us:
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-medium">{companyName}</p>
                <p><strong>Legal Department</strong></p>
                <p>Email: <a href={`mailto:${companyEmail}`} className="text-primary hover:underline">{companyEmail}</a></p>
                <p>Website: <a href={websiteUrl} className="text-primary hover:underline">{websiteUrl}</a></p>
              </div>
            </section>

            <Separator className="my-6" />

            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link href="/privacy-policy">
                <Button variant="outline" data-testid="link-privacy">View Privacy Policy</Button>
              </Link>
              <Link href="/">
                <Button data-testid="link-inventory">Back to Inventory</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
