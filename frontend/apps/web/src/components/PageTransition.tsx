"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

export type PageTransitionProps = {
    children: React.ReactNode;
    /** Unique key for AnimatePresence (typically the route path) */
    pageKey?: string;
    className?: string;
};

/**
 * Wraps page content with a subtle fade+slide entrance animation.
 * Use at the top of each page's render to unify route transitions.
 */
export function PageTransition({ children, pageKey, className }: PageTransitionProps) {
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={pageKey}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={className}
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
}
