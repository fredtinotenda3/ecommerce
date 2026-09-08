// src/app/_components/Home/NewsletterBand/index.tsx
//
// The newsletter call to action at the foot of the homepage.
//
// The form itself is `NewsletterForm`, which is honest about what it does:
// no email provider is wired up, so the address is kept in the visitor's own
// browser and nothing is transmitted. That is stated here rather than
// implied, because a sign-up box that silently discards addresses is worse
// than none.

import React from 'react'

import { Gutter } from '../../Gutter'
import { NewsletterForm } from '../../NewsletterForm'

import classes from './index.module.scss'

export const NewsletterBand: React.FC = () => (
  <section className={classes.section} aria-labelledby="newsletter-heading">
    <Gutter>
      <div className={classes.panel}>
        <div className={classes.panelWash} aria-hidden="true" />

        <div className={classes.copy}>
          <h2 id="newsletter-heading" className={classes.heading}>
            One email a month. Genuine price drops only.
          </h2>
          <p className={classes.lede}>
            New stock, real reductions, and the occasional note about which model to skip. No
            countdown timers, no daily mail.
          </p>
        </div>

        <div className={classes.form}>
          <NewsletterForm variant="dark" />
        </div>
      </div>
    </Gutter>
  </section>
)
