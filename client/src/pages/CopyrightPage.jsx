import { useTranslation } from 'react-i18next';
import LegalLayout from '../components/LegalLayout';
import { usePageMeta } from '../hooks/usePageMeta';
import { OWNER } from '../lib/owner';

export default function CopyrightPage() {
  const { t } = useTranslation();
  const legalEmail = import.meta.env.VITE_LEGAL_EMAIL || OWNER.email;
  usePageMeta(t('legal.copyrightTitle'), t('legal.copyrightSubtitle'));

  return (
    <LegalLayout title={t('legal.copyrightTitle')} subtitle={t('legal.copyrightSubtitle')}>
      <p>
        OpenLearn Hub respects the intellectual property rights of authors, publishers, educators, and software
        developers. This policy explains how we curate resources, what we refuse to list, and how rights holders can
        ask us to remove a listing.
      </p>

      <h2>1. What OpenLearn Hub is</h2>
      <p>
        OpenLearn Hub is a <strong>directory and discovery service</strong>. It does not host, store, upload, or
        distribute courses, books, PDFs, installers, or any other copyrighted files. Every listing is a link to a
        third-party website that is owned or controlled by the original provider.
      </p>
      <p>
        We link to free courses, public-domain or openly licensed books, and free and open-source software. We do not
        list cracked or pirated software, unauthorised copies of books, or links to file-sharing mirrors, torrents, or
        re-upload sites.
      </p>

      <h2>2. Our curation standards</h2>
      <ul>
        <li>
          <strong>Courses:</strong> free to access. Optional paid certificates are acceptable only where the learning
          content itself is free.
        </li>
        <li>
          <strong>Books:</strong> public domain, released under an open licence such as Creative Commons, or made
          freely available by the author or publisher.
        </li>
        <li>
          <strong>Software:</strong> free and open-source software, linked only to the official download page operated
          by the project or publisher. We never host executables.
        </li>
        <li>
          <strong>Attribution:</strong> where a licence requires attribution, we display the provider and link to the
          licence or terms page.
        </li>
      </ul>

      <h2>3. How to report a copyright concern</h2>
      <p>
        Every resource page includes a <strong>“Report this resource”</strong> button. You can also email us at{' '}
        <a href={`mailto:${legalEmail}`}>{legalEmail}</a>. Please include enough detail for us to act quickly.
      </p>

      <h3>Information to include</h3>
      <ol>
        <li>Your full name, organisation (if applicable), and contact email address.</li>
        <li>The exact URL of the OpenLearn Hub listing you believe is infringing.</li>
        <li>A description of the copyrighted work and the rights you hold.</li>
        <li>The specific nature of the concern, for example “unauthorised copy” or “licence misreported”.</li>
        <li>A statement that you have a good-faith belief the use is not authorised by the rights holder, its agent, or the law.</li>
        <li>A statement that the information in your notice is accurate, under penalty of perjury, and that you are the rights holder or authorised to act on their behalf.</li>
        <li>Your physical or electronic signature.</li>
      </ol>

      <h2>4. Our process</h2>
      <ol>
        <li>We acknowledge complete notices as soon as reasonably possible.</li>
        <li>We review the listing and the linked source, including the provider’s own licence information.</li>
        <li>
          If a concern is credible, we remove or disable the listing while we investigate. Because we do not host files,
          removal from our directory does not remove content from the third-party website.
        </li>
        <li>We may contact the submitter or provider to verify the licence.</li>
        <li>We record the outcome and will not restore a listing unless the rights issue is resolved.</li>
      </ol>

      <h2>5. Counter-notification</h2>
      <p>
        If you submitted a resource or you are the provider and believe a listing was removed in error, contact us with
        the listing URL, evidence of the applicable licence or permission, and your contact details. If we conclude the
        resource is lawful and appropriately licensed, we may restore it.
      </p>

      <h2>6. Repeat infringement</h2>
      <p>
        Accounts that repeatedly submit infringing, pirated, or misleading resources may have their submissions
        rejected and their accounts suspended or terminated.
      </p>

      <h2>7. Copyright status varies by country</h2>
      <p>
        Copyright terms differ between jurisdictions. A work that is in the public domain in one country may still be
        protected in another. We link to sources that present the work as free to access, but you are responsible for
        confirming that your own use is lawful where you live.
      </p>

      <h2>8. Contact</h2>
      <p>
        Copyright and legal notices: <a href={`mailto:${legalEmail}`}>{legalEmail}</a>. We aim to respond to complete
        notices promptly.
      </p>
    </LegalLayout>
  );
}
