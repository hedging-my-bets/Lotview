import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function PrivacyPolicy() {
  const lastUpdated = "December 2, 2024";
  const companyName = "Olympic Auto Group";
  const companyEmail = "privacy@olympicautogroup.ca";
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
            <h1 className="text-3xl font-bold mb-2" data-testid="privacy-title">Privacy Policy</h1>
            <p className="text-muted-foreground mb-6">Last Updated: {lastUpdated}</p>
            
            <Separator className="my-6" />

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
              <p className="mb-4">
                {companyName} ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website, use our vehicle inventory platform, or interact with our services.
              </p>
              <p className="mb-4">
                By using our services, you consent to the data practices described in this policy. If you do not agree with the terms of this Privacy Policy, please do not access or use our services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
              
              <h3 className="text-lg font-medium mb-3">2.1 Personal Information</h3>
              <p className="mb-4">We may collect personal information that you voluntarily provide, including:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Name, email address, and phone number</li>
                <li>Mailing address and postal code</li>
                <li>Account credentials (for dealership staff)</li>
                <li>Vehicle preferences and search history</li>
                <li>Communication records (chat, email inquiries)</li>
                <li>Payment information (processed securely by third-party processors)</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">2.2 Vehicle Inventory Data</h3>
              <p className="mb-4">For dealership partners, we collect and process:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Vehicle identification numbers (VINs)</li>
                <li>Vehicle specifications (make, model, year, mileage, condition)</li>
                <li>Pricing and availability information</li>
                <li>Vehicle images and descriptions</li>
                <li>Dealer contact information</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">2.3 Automatically Collected Information</h3>
              <p className="mb-4">When you access our services, we automatically collect:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>IP address and device information</li>
                <li>Browser type and operating system</li>
                <li>Pages viewed and time spent on pages</li>
                <li>Referral URLs and exit pages</li>
                <li>Click patterns and interaction data</li>
                <li>Location data (with your permission)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. Meta/Facebook Integration</h2>
              <p className="mb-4">
                Our platform integrates with Meta (Facebook) services for advertising and marketing purposes. This includes:
              </p>
              
              <h3 className="text-lg font-medium mb-3">3.1 Facebook Catalog API</h3>
              <p className="mb-4">
                We use the Facebook Catalog API to synchronize vehicle inventory for Automotive Inventory Ads. This allows us to display relevant vehicle listings to potential customers on Facebook, Instagram, and the Meta Audience Network.
              </p>

              <h3 className="text-lg font-medium mb-3">3.2 Facebook Pixel</h3>
              <p className="mb-4">
                We may use the Facebook Pixel to track conversions, optimize ads, and build targeted audiences. This technology collects:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Page views and vehicle detail page visits</li>
                <li>Search queries and filter selections</li>
                <li>Actions taken on our website (form submissions, contact requests)</li>
                <li>Device and browser information</li>
              </ul>

              <h3 className="text-lg font-medium mb-3">3.3 Data Sharing with Meta</h3>
              <p className="mb-4">
                When you interact with our website, data may be shared with Meta for advertising purposes. Meta may use this data to:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Show you relevant vehicle advertisements</li>
                <li>Measure ad effectiveness</li>
                <li>Build custom and lookalike audiences</li>
                <li>Improve their advertising products</li>
              </ul>
              <p className="mb-4">
                For more information about Meta's data practices, please review the{" "}
                <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Meta Privacy Policy
                </a>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. How We Use Your Information</h2>
              <p className="mb-4">We use the collected information to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Display and manage vehicle inventory listings</li>
                <li>Respond to inquiries and facilitate vehicle purchases</li>
                <li>Process financing applications and payments</li>
                <li>Send marketing communications (with your consent)</li>
                <li>Improve our website and user experience</li>
                <li>Run targeted advertising campaigns on social media platforms</li>
                <li>Analyze usage patterns and optimize our services</li>
                <li>Comply with legal obligations</li>
                <li>Prevent fraud and ensure security</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Third-Party Service Providers</h2>
              <p className="mb-4">We may share your information with trusted third parties who assist us in operating our business:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Meta/Facebook:</strong> Advertising and catalog management</li>
                <li><strong>Payment Processors:</strong> Secure payment handling</li>
                <li><strong>Analytics Providers:</strong> Website analytics and optimization</li>
                <li><strong>Cloud Hosting:</strong> Secure data storage and processing</li>
                <li><strong>CRM Systems:</strong> Customer relationship management</li>
                <li><strong>Vehicle Data Providers:</strong> VIN decoding and vehicle history</li>
              </ul>
              <p className="mb-4">
                These providers are contractually obligated to protect your information and use it only for the purposes we specify.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Cookies and Tracking Technologies</h2>
              <p className="mb-4">
                We use cookies and similar tracking technologies to enhance your experience. These include:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Essential Cookies:</strong> Required for website functionality</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how visitors use our site</li>
                <li><strong>Advertising Cookies:</strong> Used for targeted advertising (including Facebook Pixel)</li>
                <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
              </ul>
              <p className="mb-4">
                You can manage cookie preferences through your browser settings. Note that disabling certain cookies may affect website functionality.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Your Rights and Choices</h2>
              
              <h3 className="text-lg font-medium mb-3">7.1 Access and Correction</h3>
              <p className="mb-4">
                You have the right to access, correct, or update your personal information at any time by contacting us.
              </p>

              <h3 className="text-lg font-medium mb-3">7.2 Deletion</h3>
              <p className="mb-4">
                You may request deletion of your personal information, subject to certain legal exceptions (e.g., transaction records we must retain).
              </p>

              <h3 className="text-lg font-medium mb-3">7.3 Opt-Out of Marketing</h3>
              <p className="mb-4">
                You can opt out of marketing communications at any time by clicking "unsubscribe" in any email or contacting us directly.
              </p>

              <h3 className="text-lg font-medium mb-3">7.4 Advertising Opt-Out</h3>
              <p className="mb-4">
                To opt out of interest-based advertising:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>
                  <a href="https://www.facebook.com/settings/?tab=ads" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Facebook Ad Preferences
                  </a>
                </li>
                <li>
                  <a href="https://optout.networkadvertising.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Network Advertising Initiative
                  </a>
                </li>
                <li>
                  <a href="https://optout.aboutads.info/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Digital Advertising Alliance
                  </a>
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">8. GDPR Rights (European Users)</h2>
              <p className="mb-4">If you are in the European Economic Area (EEA), you have additional rights:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Right to Access:</strong> Obtain a copy of your personal data</li>
                <li><strong>Right to Rectification:</strong> Correct inaccurate data</li>
                <li><strong>Right to Erasure:</strong> Request deletion ("right to be forgotten")</li>
                <li><strong>Right to Restrict Processing:</strong> Limit how we use your data</li>
                <li><strong>Right to Data Portability:</strong> Receive your data in a portable format</li>
                <li><strong>Right to Object:</strong> Object to processing for direct marketing</li>
                <li><strong>Right to Withdraw Consent:</strong> Withdraw consent at any time</li>
              </ul>
              <p className="mb-4">
                To exercise these rights, contact us at {companyEmail}. We will respond within 30 days.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">9. CCPA Rights (California Residents)</h2>
              <p className="mb-4">If you are a California resident, you have the right to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Know what personal information we collect and how it's used</li>
                <li>Request deletion of your personal information</li>
                <li>Opt out of the "sale" of personal information</li>
                <li>Non-discrimination for exercising your privacy rights</li>
              </ul>
              <p className="mb-4">
                We do not sell personal information in the traditional sense, but sharing data with advertising partners may constitute a "sale" under CCPA. To opt out, contact us or use our cookie management tools.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">10. Data Security</h2>
              <p className="mb-4">
                We implement industry-standard security measures to protect your information, including:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>SSL/TLS encryption for data in transit</li>
                <li>Encrypted data storage</li>
                <li>Access controls and authentication</li>
                <li>Regular security audits</li>
                <li>Employee training on data protection</li>
              </ul>
              <p className="mb-4">
                However, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">11. Data Retention</h2>
              <p className="mb-4">
                We retain personal information for as long as necessary to provide our services and comply with legal obligations. Typical retention periods:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li><strong>Account data:</strong> Duration of account plus 7 years</li>
                <li><strong>Transaction records:</strong> 7 years (legal requirement)</li>
                <li><strong>Marketing data:</strong> Until opt-out or 3 years of inactivity</li>
                <li><strong>Analytics data:</strong> 26 months (anonymized)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">12. Children's Privacy</h2>
              <p className="mb-4">
                Our services are not intended for children under 18 years of age. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">13. Changes to This Policy</h2>
              <p className="mb-4">
                We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the "Last Updated" date. Continued use of our services after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">14. Contact Us</h2>
              <p className="mb-4">
                If you have questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="font-medium">{companyName}</p>
                <p>Email: <a href={`mailto:${companyEmail}`} className="text-primary hover:underline">{companyEmail}</a></p>
                <p>Website: <a href={websiteUrl} className="text-primary hover:underline">{websiteUrl}</a></p>
              </div>
            </section>

            <Separator className="my-6" />

            <div className="flex flex-col sm:flex-row gap-4 mt-8">
              <Link href="/terms-of-service">
                <Button variant="outline" data-testid="link-terms">View Terms of Service</Button>
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
