"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowButton } from "@/components/ui/ArrowCta";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { nativeDarkControlClass } from "@/components/ui/nativeDarkField";
import { shouldUnoptimizeEventImage } from "@/lib/utils/image";
import { marketingImages } from "@/lib/marketing-images";
import { LEGAL_OFFICE_ADDRESS } from "@/lib/legal/links";
import {
  CONTACT_SUBJECTS,
  contactFormSchema,
  type ContactFormInput,
} from "@/lib/marketing/contact";
import {
  PLATFORM_SUPPORT_EMAIL,
  platformSupportMailto,
} from "@/lib/site-contact";

/** Vertical rhythm between major sections — matches `OrganizersMarketingPage`. */
const SECTION = "mb-16 md:mb-24";

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp = (reduce: boolean, delay = 0) => ({
  hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease, delay },
  },
});

function ContactParallaxHero() {
  const ref = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const reduce = reduceMotion ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 120]);
  const opacity = useTransform(scrollYProgress, [0, 0.45], [1, 0.35]);

  return (
    <section
      ref={ref}
      className={`relative left-1/2 ${SECTION} w-screen max-w-[100vw] -translate-x-1/2 overflow-hidden -mt-[calc(2rem+4.25rem)] md:-mt-[calc(2.5rem+4.25rem)]`}
    >
      <div className="relative min-h-[min(64vh,560px)] w-full">
        <motion.div className="absolute inset-0 h-[115%] w-full -top-[8%]" style={{ y }}>
          <Image
            src={marketingImages.organizerTeam}
            alt="All AXS team collaborating in a bright planning space"
            fill
            priority
            unoptimized={shouldUnoptimizeEventImage(marketingImages.organizerTeam)}
            className="object-cover object-center"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-zinc-950/45" aria-hidden />
          <div className="axs-hero-scrim-animated absolute inset-0 opacity-95" aria-hidden />
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(24,24,27,0.42)_0%,rgba(9,9,11,0.55)_32%,rgba(9,9,11,0.78)_58%,rgba(3,3,4,0.94)_100%)]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent to-black/40"
            aria-hidden
          />
        </motion.div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-20 bg-linear-to-b from-transparent to-background md:h-24"
          aria-hidden
        />
        <motion.div
          className="relative z-10 flex min-h-[min(64vh,560px)] flex-col justify-end pb-14 pt-24 md:pb-20 md:pt-28"
          style={{ opacity }}
        >
          <div className="axs-page-shell w-full">
            <div className="axs-content-inner">
              <motion.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: { transition: { staggerChildren: 0.09 } },
                }}
                className="max-w-3xl space-y-6"
              >
                <motion.p
                  variants={fadeUp(reduce, 0)}
                  className="text-xs font-semibold uppercase tracking-[0.28em] text-primary"
                >
                  Contact
                </motion.p>
                <motion.h1
                  variants={fadeUp(reduce, 0.05)}
                  className="font-display text-4xl leading-[1.08] tracking-tight text-white sm:text-5xl md:text-[3.15rem]"
                >
                  Tell us what you need — we read every message
                </motion.h1>
                <motion.p
                  variants={fadeUp(reduce, 0.1)}
                  className="max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl"
                >
                  Whether you&apos;re a fan with a ticket question, an organizer planning your next
                  event, or a partner with a proposal — we usually reply within one business day.
                </motion.p>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

type SubmitStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

function ContactFormSection({ reduce }: { reduce: boolean }) {
  const [status, setStatus] = useState<SubmitStatus>({ kind: "idle" });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormInput>({
    resolver: zodResolver(contactFormSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      subject: "General",
      message: "",
    },
  });

  const onSubmit = async (data: ContactFormInput) => {
    setStatus({ kind: "submitting" });
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
      };
      if (response.ok && body.ok !== false) {
        setStatus({
          kind: "success",
          message: body.message ?? "Thanks — your message reached our team.",
        });
        reset({ name: "", email: "", subject: "General", message: "" });
      } else {
        setStatus({
          kind: "error",
          message:
            body.message ??
            `We couldn't deliver that just now. Please email ${PLATFORM_SUPPORT_EMAIL} directly.`,
        });
      }
    } catch {
      setStatus({
        kind: "error",
        message:
          `We couldn't reach the server. Please email ${PLATFORM_SUPPORT_EMAIL} directly.`,
      });
    }
  };

  return (
    <section className={SECTION} aria-labelledby="form-heading">
      <div className="axs-page-shell">
        <div className="axs-content-inner">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14 items-start">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
            >
              <motion.p
                variants={fadeUp(reduce)}
                id="form-heading"
                className="text-xs font-semibold uppercase tracking-[0.22em] text-primary"
              >
                Send a message
              </motion.p>
              <motion.h2
                variants={fadeUp(reduce, 0.05)}
                className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
              >
                Drop us a note — include any order reference or event name
              </motion.h2>
              <motion.p variants={fadeUp(reduce, 0.1)} className="mt-4 text-muted text-lg leading-relaxed">
                We route messages by topic, so picking the closest match helps the right person reply
                faster.
              </motion.p>

              <motion.form
                variants={fadeUp(reduce, 0.14)}
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="mt-8 space-y-4"
              >
                {status.kind === "success" ? (
                  <div
                    role="status"
                    className="rounded-[var(--radius-card)] border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
                  >
                    {status.message}
                  </div>
                ) : null}
                {status.kind === "error" ? (
                  <div
                    role="alert"
                    className="rounded-[var(--radius-card)] border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"
                  >
                    {status.message}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Your name"
                    type="text"
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                    {...register("name")}
                    error={errors.name?.message}
                  />
                  <Input
                    label="Email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    {...register("email")}
                    error={errors.email?.message}
                  />
                </div>

                <div className="w-full">
                  <label
                    htmlFor="contact-subject"
                    className="mb-1 block text-sm font-medium text-foreground"
                  >
                    Topic
                  </label>
                  <select
                    id="contact-subject"
                    aria-invalid={errors.subject ? "true" : "false"}
                    aria-describedby={
                      errors.subject ? "contact-subject-error" : undefined
                    }
                    className={nativeDarkControlClass(Boolean(errors.subject))}
                    {...register("subject")}
                  >
                    {CONTACT_SUBJECTS.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                  {errors.subject?.message ? (
                    <p
                      id="contact-subject-error"
                      className="mt-1 text-sm text-primary"
                      role="alert"
                    >
                      {errors.subject.message}
                    </p>
                  ) : null}
                </div>

                <Textarea
                  label="Message"
                  rows={6}
                  placeholder="Tell us what you need — including any order reference, event name, or specific question."
                  {...register("message")}
                  error={errors.message?.message}
                />

                <div className="pt-2">
                  <ArrowButton
                    type="submit"
                    variant="primary"
                    disabled={status.kind === "submitting"}
                  >
                    {status.kind === "submitting" ? "Sending…" : "Send message"}
                  </ArrowButton>
                </div>

                <p className="text-xs leading-relaxed text-muted">
                  By submitting this form you agree to our{" "}
                  <Link href="/privacy" className="font-semibold text-primary hover:underline">
                    privacy policy
                  </Link>
                  . We use your details only to reply to your message.
                </p>
              </motion.form>
            </motion.div>

            <motion.aside
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-40px" }}
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
              className="space-y-6"
              aria-label="Contact details"
            >
              <motion.div
                variants={fadeUp(reduce)}
                className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  Email
                </p>
                <p className="mt-3 font-display text-lg font-semibold text-foreground">
                  <a
                    href={platformSupportMailto()}
                    className="hover:text-primary hover:underline"
                  >
                    {PLATFORM_SUPPORT_EMAIL}
                  </a>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  General inquiries, refunds, partnerships, and organizer questions. We aim to reply
                  within one business day.
                </p>
              </motion.div>

              <motion.div
                variants={fadeUp(reduce, 0.04)}
                className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  Office
                </p>
                <address className="mt-3 not-italic text-sm leading-relaxed text-foreground/90">
                  {LEGAL_OFFICE_ADDRESS}
                </address>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  Visits are by appointment — please reach out by email first.
                </p>
              </motion.div>

              <motion.div
                variants={fadeUp(reduce, 0.08)}
                className="rounded-[var(--radius-panel)] border border-border bg-surface p-6 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                  Looking for something else?
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <Link
                      href="/help"
                      className="font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      Fan help center
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/organizers"
                      className="font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      For organizers
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/pricing"
                      className="font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/refund-policy"
                      className="font-semibold text-foreground hover:text-primary hover:underline"
                    >
                      Refund policy
                    </Link>
                  </li>
                </ul>
              </motion.div>
            </motion.aside>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ContactMarketingPage() {
  const reduce = useReducedMotion() ?? false;

  return (
    <div>
      <ContactParallaxHero />
      <ContactFormSection reduce={reduce} />
    </div>
  );
}
