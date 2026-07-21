/**
 * Nation-specific home-education legal context, shown on the dashboard and
 * the printable evidence report.
 *
 * This is general information, not legal advice, and it is a simplified
 * summary — home education law differs materially across the four UK
 * nations, and the England/Wales "Children Not in School" register regime
 * (Children's Wellbeing and Schools Act 2026) is law but NOT YET IN FORCE
 * anywhere as of the last-reviewed date below; commencement depends on
 * regulations that have not been made. Scotland and Northern Ireland run
 * entirely separate regimes and are unaffected by that Act. Content here
 * is deliberately hedged and dated rather than presented as a compliance
 * guarantee — see PLAN.md for the fuller rationale and sourcing caveats.
 */

export const LEGAL_CONTENT_LAST_REVIEWED = '2026-07-21';

export type Nation = 'england' | 'wales' | 'scotland' | 'northern_ireland';

export interface NationContent {
  label: string;
  legalStandard: string;
  currentDuties: string[];
}

export const NATION_LABELS: Record<Nation, string> = {
  england: 'England',
  wales: 'Wales',
  scotland: 'Scotland',
  northern_ireland: 'Northern Ireland',
};

const NATION_CONTENT: Record<Nation, NationContent> = {
  england: {
    label: 'England',
    legalStandard:
      'Education Act 1996, s.7 — parents must ensure their child receives efficient, full-time education suitable to age, ability, aptitude, and any special educational needs.',
    currentDuties: [
      'There is currently no legal duty to register with your council or to allow a home visit. A council may make informal enquiries; a written, dated education report is a sufficient response, and samples of your child’s work are not required.',
      'The Children’s Wellbeing and Schools Act 2026 introduces a "Children Not in School" register and related duties, but these are not yet in force — commencement depends on regulations not yet made, and is not expected before 2027. This page will be updated once they take effect.',
      'If a council isn’t satisfied education is suitable, it must give at least 15 days to respond before taking further action — a clear, dated report like this one is the standard way to respond.',
    ],
  },
  wales: {
    label: 'Wales',
    legalStandard:
      'Education Act 1996, s.7 — the same "efficient, full-time education suitable to age, ability, aptitude, and any special educational needs" standard as England.',
    currentDuties: [
      'There is currently no statutory duty to register as home educating. The Senedd has agreed to adopt "Children Not in School" register provisions similar to England’s, but Welsh secondary legislation and a public consultation are still to come, with commencement not expected before 2027.',
      'Non-statutory Welsh Government guidance recommends a council make contact about once a year at a mutually agreed location — you can decline a home visit and suggest an alternative.',
    ],
  },
  scotland: {
    label: 'Scotland',
    legalStandard:
      'Education (Scotland) Act 1980, s.30 — parents must provide efficient education suitable to age, ability and aptitude, either through school or "by other means". Scotland is unaffected by England’s 2026 Act and runs its own system.',
    currentDuties: [
      'If your child currently attends, or has ever attended, a Scottish state school, you need your council’s consent to withdraw them (s.35). Consent "shall not be unreasonably withheld", and Scottish Government guidance says a decision should normally be issued within 6 weeks of your request.',
      'Consent generally isn’t needed if your child never attended a state school, attended only an independent school, or is moving between finishing primary and starting secondary.',
    ],
  },
  northern_ireland: {
    label: 'Northern Ireland',
    legalStandard:
      'Parents must secure efficient, full-time education suitable to age, ability, aptitude, and any special educational needs. Northern Ireland is unaffected by England’s 2026 Act and has no statutory home-education register.',
    currentDuties: [
      'The Education Authority follows its "Moving Forward" guidelines (2018) — a support-oriented approach, not an enforcement one. There is no legal duty to register or to allow a home visit.',
    ],
  },
};

export function getNationContent(nation: Nation): NationContent {
  return NATION_CONTENT[nation];
}

export const LEGAL_CONTENT_FOOTER =
  'This is general information, not legal advice, reflecting the law as understood on ' +
  LEGAL_CONTENT_LAST_REVIEWED +
  ' — home education law is changing, especially in England and Wales, so check current official guidance for your nation. No UK nation currently gives a council the right to enter your home or compel seeing your child without your agreement.';
