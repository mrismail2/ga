import React from 'react';
import { Image } from 'react-native';

const MARK = require('../../assets/kobciye-logo.png');
const MARK_WHITE = require('../../assets/kobciye-logo-white.png');
const RATIO = 351 / 86; // wordmark width / height

/* Kobciye brand wordmark — the official book-"K" logo with the "kobciye
   MANAGEMENT SYSTEM" lettering (transparent background). `size` is the
   rendered height; use variant="white" on dark backgrounds. */
export default function Logo({ size = 40, variant = 'dark' }) {
  return (
    <Image
      source={variant === 'white' ? MARK_WHITE : MARK}
      style={{ height: size, width: size * RATIO, resizeMode: 'contain' }}
      accessibilityLabel="Kobciye — Management System"
    />
  );
}
