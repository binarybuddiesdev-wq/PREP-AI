import { useState } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { Link } from 'react-router';

import type { ILandingNavProps } from './LandingNav.types';

export const LandingNav = (props: ILandingNavProps) => {
  const { homeTo, signInTo, signUpTo, theme, onToggleTheme } = props;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuIcon = isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />;
  const themeIcon = theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />;

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="landing-nav">
      <Link className="landing-brand" to={homeTo} onClick={closeMenu}>
        <span className="landing-mark" aria-hidden="true">
          P
        </span>
        PrepAI
      </Link>
      <nav
        className={`landing-nav__content${isMenuOpen ? ' is-open' : ''}`}
        aria-label="Main navigation"
        id="landing-primary-navigation"
      >
        <div className="landing-nav__menu">
          <a href="#ld-feats" onClick={closeMenu}>
            Features
          </a>
          <a href="#ld-how" onClick={closeMenu}>
            How It Works
          </a>
          <a href="#ld-stats" onClick={closeMenu}>
            Results
          </a>
        </div>
        <div className="landing-nav__actions">
          <button
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="landing-icon-button landing-nav__theme"
            onClick={onToggleTheme}
            type="button"
          >
            {themeIcon}
          </button>
          <Link className="landing-nav__login" to={signInTo} onClick={closeMenu}>
            Log in
          </Link>
          <Link
            className="landing-button landing-button--primary landing-nav__start"
            to={signUpTo}
            onClick={closeMenu}
          >
            Start Free
          </Link>
        </div>
      </nav>
      <div className="landing-nav__tools">
        <button
          aria-expanded={isMenuOpen}
          aria-controls="landing-primary-navigation"
          aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="landing-icon-button landing-nav__toggle"
          onClick={() => setIsMenuOpen((open) => !open)}
          type="button"
        >
          {menuIcon}
        </button>
      </div>
    </header>
  );
};
