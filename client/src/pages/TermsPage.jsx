import { useTranslation } from 'react-i18next';
import LegalLayout from '../components/LegalLayout';
import { usePageMeta } from '../hooks/usePageMeta';

export default function TermsPage() {
  const { t } = useTranslation();
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || 'hello@openlearnhub.org';
  usePageMeta(t('legal.termsTitle'), t('legal.termsSubtitle'));

  return (
    <LegalLayout title={t('legal.termsTitle')} subtitle={t('legal.termsSubtitle')}>
      <p>
        These Terms of Use govern your access to OpenLearn Hub. By using the website, creating an account, or
        submitting a resource, you agree to these terms. If you do not agree, please do not use the service.
      </p>

      <h2>1. What we provide</h2>
      <p>
        OpenLearn Hub is a free directory of third-party learning resources. We organise and describe links, but we do
        not create the linked courses, books, or software, and we do not host or distribute their files. We are not
        affiliated with the providers unless we state otherwise.
      </p>

      <h2>2. Accounts</h2>
      <ul>
        <li>You must provide accurate information and keep your password secure.</li>
        <li>You are responsible for activity under your account.</li>
        <li>You must be old enough to enter into a binding agreement in your country, or have permission from a parent or guardian.</li>
        <li>We may suspend or terminate accounts that abuse the service, submit illegal content, or breach these terms.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>submit pirated, cracked, or unlicensed material;</li>
        <li>link to file-sharing mirrors, torrents, or unofficial re-uploads of copyrighted works;</li>
        <li>upload executable files or attempt to distribute software through OpenLearn Hub;</li>
        <li>submit spam, misleading listings, or content that promotes illegal activity;</li>
        <li>scrape, overload, or attempt to disrupt the service or its security;</li>
        <li>impersonate another person, provider, or organisation;</li>
        <li>use the AI assistant to generate unlawful, harmful, or abusive content.</li>
      </ul>

      <h2>4. Community submissions</h2>
      <p>
        When you submit a resource, you confirm that the link is legal to share, that you have not uploaded copyrighted
        files, and that the link points to the official source. You grant us a non-exclusive, worldwide, royalty-free
        licence to display, describe, translate, and promote the submission within OpenLearn Hub. You retain ownership
        of anything you create.
      </p>
      <p>
        We may edit, reject, or remove submissions at our discretion. All submissions are reviewed before publication.
      </p>

      <h2>5. Our licence to you</h2>
      <p>
        The OpenLearn Hub website design, curation text, and original content are protected by applicable law. You may
        use the service for personal and educational purposes. You may not copy our branding or wholesale reproduce the
        directory without permission.
      </p>

      <h2>6. Third-party resources</h2>
      <p>
        Your use of a linked course, book, or software is governed by that provider’s own terms and licence. We are not
        responsible for third-party content, availability, pricing changes, or data practices. Always check the
        provider’s terms before enrolling, downloading, or sharing.
      </p>

      <h2>7. AI assistant</h2>
      <p>
        LearnMate is an experimental assistant that suggests resources from our directory. AI output can be incomplete
        or wrong. It is not professional, academic, legal, or career advice. You are responsible for verifying
        important information with the official provider.
      </p>

      <h2>8. Disclaimer</h2>
      <p>
        The service is provided “as is” and “as available”, without warranties of any kind, to the fullest extent
        permitted by law. We do not warrant that listings are complete, current, or error-free.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, OpenLearn Hub and its operators are not liable for indirect, incidental,
        special, consequential, or punitive damages, or for any loss arising from your use of the service or of a
        third-party resource.
      </p>

      <h2>10. Changes and termination</h2>
      <p>
        We may update these terms or the service at any time. Material changes will be reflected by the “last updated”
        date. Continued use after a change means you accept the updated terms. You may stop using the service at any
        time.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>
    </LegalLayout>
  );
}
