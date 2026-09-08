// src/app/_components/Home/Testimonials/index.tsx
//
// Customer quotes.
//
// Marked up as `<figure>`/`<blockquote>`/`<figcaption>` rather than divs, so
// the attribution is programmatically tied to the quote it belongs to.
//
// There are deliberately no star ratings and no aggregate score: a rating
// this store has not actually collected would be a fabricated review, and
// three specific quotes read as more credible than a wall of five stars.

import React from 'react'

import { TESTIMONIALS } from '../../../constants/brand'
import { Gutter } from '../../Gutter'

import classes from './index.module.scss'

export const Testimonials: React.FC = () => {
  if (TESTIMONIALS.length === 0) return null

  return (
    <section className={classes.section} aria-labelledby="testimonials-heading">
      <Gutter>
        <p className={classes.eyebrow}>What customers say</p>
        <h2 id="testimonials-heading" className={classes.heading}>
          Bought here, and said so afterwards
        </h2>

        <div className={classes.grid}>
          {TESTIMONIALS.map(testimonial => (
            <figure key={testimonial.name} className={classes.card}>
              <svg
                className={classes.quoteMark}
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M9.5 5C6.5 6.6 5 9.2 5 12.8V19h6.2v-6.2H8.4c0-2.3.8-3.9 2.4-4.9L9.5 5Zm9 0C15.5 6.6 14 9.2 14 12.8V19h6.2v-6.2h-2.8c0-2.3.8-3.9 2.4-4.9L18.5 5Z" />
              </svg>

              <blockquote className={classes.quote}>
                <p>{testimonial.quote}</p>
              </blockquote>

              <figcaption className={classes.attribution}>
                <span className={classes.name}>{testimonial.name}</span>
                <span className={classes.role}>{testimonial.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </Gutter>
    </section>
  )
}
