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
                These Terms apply to all visitors, users, customers, and dealership partners who access or use the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
              <p className="mb-4">
                {companyName} provides a cloud-based vehicle inventory management and marketing platform designed for automotive dealerships. Our Service includes:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Vehicle inventory listing and management</li>
                <li>Customer browsing and vehicle search functionality</li>
                <li>Financing calculator and payment estimation tools</li>
                <li>Integration with third-party advertising platforms (including Meta/Facebook)</li>
                <li>AI-powered vehicle descriptions and chat assistance</li>
                <li>Analytics and reporting tools</li>
                <li>Multi-location dealership management</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. User Accounts</h2>
              
              <h3 className="text-lg font-medium mb-3">3.1 Account Registration</h3>
              <p className="mb-4">
                To access certain features, you may need to create an account. You agree to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security of your password and account</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized access</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">3.2 Account Types</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Customer Accounts:</strong> For browsing inventory and making inquiries</li>
                <li><strong>Dealership Staff Accounts:</strong> For managing inventory and customer interactions</li>
                <li><strong>Manager Accounts:</strong> For dealership-level administration and analytics</li>
                <li><strong>Admin Accounts:</strong> For system configuration and user management</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. Dealership Partner Terms</h2>
              
              <h3 className="text-lg font-medium mb-3">4.1 Data Ownership</h3>
              <p className="mb-4">
                Dealership partners retain ownership of all vehicle inventory data, customer information, and business records they upload to the Service. We process this data solely to provide the Service.
              </p>

              <h3 className="text-lg font-medium mb-3">4.2 License Grant</h3>
              <p className="mb-4">
                By uploading content to the Service, you grant us a non-exclusive, royalty-free license to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Display your vehicle listings to potential customers</li>
                <li>Syndicate listings to third-party advertising platforms</li>
                <li>Create backups and maintain system integrity</li>
                <li>Use aggregated, anonymized data for analytics and improvement</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">4.3 Dealership Responsibilities</h3>
              <p className="mb-4">Dealership partners agree to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Provide accurate vehicle information (VIN, mileage, condition, pricing)</li>
                <li>Comply with all applicable consumer protection and advertising laws</li>
                <li>Maintain valid dealer licenses and business registrations</li>
                <li>Respond to customer inquiries in a timely manner</li>
                <li>Remove sold or unavailable vehicles promptly</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Acceptable Use Policy</h2>
              <p className="mb-4">You agree NOT to use the Service to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>List vehicles you do not own or have authority to sell</li>
                <li>Provide false, misleading, or deceptive information</li>
                <li>Engage in fraudulent pricing practices (bait-and-switch, hidden fees)</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Infringe on intellectual property rights</li>
                <li>Upload malware, viruses, or harmful code</li>
                <li>Attempt to gain unauthorized access to systems</li>
                <li>Scrape or harvest data without permission</li>
                <li>Interfere with the proper functioning of the Service</li>
                <li>Harass, abuse, or threaten other users</li>
                <li>Use the Service to build a competing product</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Third-Party Integrations</h2>
              
              <h3 className="text-lg font-medium mb-3">6.1 Meta/Facebook Integration</h3>
              <p className="mb-4">
                Our Service integrates with Meta platforms (Facebook, Instagram) for advertising purposes. By enabling these integrations, you agree to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Meta's Terms of Service and Commerce Policies</li>
                <li>Automotive Inventory Ads requirements</li>
                <li>Data sharing as described in our Privacy Policy</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">6.2 Other Third-Party Services</h3>
              <p className="mb-4">
                The Service may integrate with payment processors, VIN decoders, market data providers, and other third-party services. Your use of these services is subject to their respective terms and conditions. We are not responsible for third-party service availability or performance.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Fees and Payment</h2>
              
              <h3 className="text-lg font-medium mb-3">7.1 Subscription Fees</h3>
              <p className="mb-4">
                Dealership partners may be subject to subscription fees as specified in separate agreements. Fees are billed in advance and are non-refundable unless otherwise stated.
              </p>

              <h3 className="text-lg font-medium mb-3">7.2 Payment Terms</h3>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>All fees are in Canadian Dollars (CAD) unless otherwise specified</li>
                <li>Payment is due within 30 days of invoice</li>
                <li>Late payments may incur interest at 1.5% per month</li>
                <li>We reserve the right to suspend service for non-payment</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">7.3 Taxes</h3>
              <p className="mb-4">
                All fees exclude applicable taxes (GST, HST, PST). You are responsible for all taxes related to your use of the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">8. Intellectual Property</h2>
              
              <h3 className="text-lg font-medium mb-3">8.1 Our Intellectual Property</h3>
              <p className="mb-4">
                The Service, including its design, features, functionality, software, and content (excluding user-provided content), is owned by {companyName} and protected by copyright, trademark, and other intellectual property laws.
              </p>

              <h3 className="text-lg font-medium mb-3">8.2 Limited License</h3>
              <p className="mb-4">
                We grant you a limited, non-exclusive, non-transferable license to access and use the Service for your internal business purposes during your subscription term.
              </p>

              <h3 className="text-lg font-medium mb-3">8.3 Restrictions</h3>
              <p className="mb-4">You may not:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Copy, modify, or distribute our software or content</li>
                <li>Reverse engineer, decompile, or disassemble the Service</li>
                <li>Remove any proprietary notices or labels</li>
                <li>Sublicense or resell access to the Service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">9. Disclaimer of Warranties</h2>
              <p className="mb-4 font-semibold">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>WARRANTIES OF MERCHANTABILITY</li>
                <li>FITNESS FOR A PARTICULAR PURPOSE</li>
                <li>NON-INFRINGEMENT</li>
                <li>ACCURACY OR COMPLETENESS OF CONTENT</li>
              </ul>
              <p className="mb-4">
                We do not warrant that the Service will be uninterrupted, secure, or error-free. We are not responsible for the accuracy of vehicle listings or third-party data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">10. Limitation of Liability</h2>
              <p className="mb-4 font-semibold">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>OUR TOTAL LIABILITY SHALL NOT EXCEED THE FEES PAID BY YOU IN THE 12 MONTHS PRECEDING THE CLAIM</li>
                <li>WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES</li>
                <li>WE ARE NOT LIABLE FOR LOST PROFITS, DATA, OR BUSINESS OPPORTUNITIES</li>
                <li>WE ARE NOT LIABLE FOR ACTIONS OF THIRD PARTIES OR OTHER USERS</li>
              </ul>
              <p className="mb-4">
                Some jurisdictions do not allow limitation of liability for certain damages. In such cases, our liability is limited to the maximum extent permitted by law.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">11. Indemnification</h2>
              <p className="mb-4">
                You agree to indemnify, defend, and hold harmless {companyName}, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including reasonable attorney's fees) arising from:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Your use of the Service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any third-party rights</li>
                <li>Any content you upload or provide</li>
                <li>Any vehicle transaction disputes</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">12. Termination</h2>
              
              <h3 className="text-lg font-medium mb-3">12.1 Termination by You</h3>
              <p className="mb-4">
                You may terminate your account at any time by contacting us. Termination is effective at the end of your current billing period.
              </p>

              <h3 className="text-lg font-medium mb-3">12.2 Termination by Us</h3>
              <p className="mb-4">We may suspend or terminate your access if:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>You breach these Terms</li>
                <li>You fail to pay fees when due</li>
                <li>Your account shows fraudulent or illegal activity</li>
                <li>Required by law or legal process</li>
                <li>We discontinue the Service</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">12.3 Effect of Termination</h3>
              <p className="mb-4">Upon termination:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Your access to the Service immediately ceases</li>
                <li>You have 30 days to export your data</li>
                <li>After 30 days, we may delete your data</li>
                <li>Sections on indemnification, liability, and dispute resolution survive</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">13. Modifications to Terms</h2>
              <p className="mb-4">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on our website and updating the "Last Updated" date.
              </p>
              <p className="mb-4">
                Continued use of the Service after changes become effective constitutes acceptance of the modified Terms. If you do not agree to the changes, you must stop using the Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">14. Dispute Resolution</h2>
              
              <h3 className="text-lg font-medium mb-3">14.1 Governing Law</h3>
              <p className="mb-4">
                These Terms are governed by the laws of British Columbia, Canada, without regard to conflict of law principles.
              </p>

              <h3 className="text-lg font-medium mb-3">14.2 Dispute Process</h3>
              <p className="mb-4">
                Before initiating formal proceedings, you agree to contact us and attempt to resolve the dispute informally for at least 30 days.
              </p>

              <h3 className="text-lg font-medium mb-3">14.3 Jurisdiction</h3>
              <p className="mb-4">
                Any legal action arising from these Terms shall be brought exclusively in the courts of British Columbia, Canada. You consent to the personal jurisdiction of such courts.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">15. General Provisions</h2>
              
              <h3 className="text-lg font-medium mb-3">15.1 Entire Agreement</h3>
              <p className="mb-4">
                These Terms, together with our Privacy Policy, constitute the entire agreement between you and {companyName} regarding the Service.
              </p>

              <h3 className="text-lg font-medium mb-3">15.2 Severability</h3>
              <p className="mb-4">
                If any provision of these Terms is found unenforceable, the remaining provisions will remain in full force and effect.
              </p>

              <h3 className="text-lg font-medium mb-3">15.3 Waiver</h3>
              <p className="mb-4">
                Our failure to enforce any right or provision of these Terms does not constitute a waiver of that right.
              </p>

              <h3 className="text-lg font-medium mb-3">15.4 Assignment</h3>
              <p className="mb-4">
                You may not assign these Terms without our written consent. We may assign our rights and obligations to an affiliate or in connection with a merger or acquisition.
              </p>

              <h3 className="text-lg font-medium mb-3">15.5 Force Majeure</h3>
              <p className="mb-4">
                Neither party is liable for delays or failures due to circumstances beyond reasonable control (natural disasters, war, government actions, internet outages, etc.).
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">16. Contact Information</h2>
              <p className="mb-4">
                For questions about these Terms of Service, please contact us:
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-medium">{companyName}</p>
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
