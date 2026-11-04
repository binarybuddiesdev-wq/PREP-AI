import type { ILandingFooterProps } from './LandingFooter.types';

export const LandingFooter = (props: ILandingFooterProps) => {
  const { year } = props;

  return (
    <footer className="landing-footer">
      <span>© {year} PrepAI</span>
      <div aria-label="Company links" className="landing-footer__links">
        <span>Privacy</span>
        <span>Terms</span>
        <span>Twitter</span>
        <span>GitHub</span>
      </div>
    </footer>
  );
};
