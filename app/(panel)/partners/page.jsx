import { loadPartnerPublish } from '@/lib/partnerPublish';
import PartnerPublishTable from '@/components/PartnerPublishTable';

export const dynamic = 'force-dynamic';

export default async function Partners() {
  const { partners, sites, generated } = await loadPartnerPublish();
  return <PartnerPublishTable initial={partners} sites={sites} generated={generated} />;
}
