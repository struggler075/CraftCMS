// Real password-strength evaluator.
//
// Combines an Anderson-style charset entropy estimate (length × log2(alphabet))
// with empirical Shannon entropy of the actual symbols typed, and applies
// penalties for the patterns that wreck a charset estimate in practice:
// dictionary hits, character runs, keyboard sequences and date-ish strings.
//
// Output is calibrated against the NIST SP 800-63 / OWASP rule of thumb:
//   < 28 bits  trivially crackable (seconds)
//   28–40      online attack survivable, offline broken in minutes
//   40–60      offline attack measured in days
//   60–80      offline attack measured in years on commodity GPUs
//   80+        effectively brute-force resistant

const TOP_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345', '1234567',
  '12345678', '123456789', '1234567890', 'qwerty', 'qwerty123', 'qwertyuiop',
  'abc123', 'letmein', 'iloveyou', 'welcome', 'admin', 'admin123', 'root',
  'monkey', 'dragon', 'sunshine', '111111', '000000', '666666', '654321',
  'princess', 'football', 'baseball', 'master', 'passw0rd', 'p@ssw0rd',
  'minecraft', 'craftcms', 'changeme', 'test', 'test123', 'pass', 'pass123',
  '1q2w3e4r', 'zaq12wsx', 'q1w2e3r4', 'asdfgh', 'asdf', 'zxcvbn',
])

const KEYBOARD_RUNS = [
  'abcdefghijklmnopqrstuvwxyz',
  '0123456789',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm',
  '!@#$%^&*()',
  'йцукенгшщзхъ',
  'фывапролджэ',
  'ячсмитьбю',
]

function reverse(s: string): string {
  return s.split('').reverse().join('')
}

function charsetSize(pw: string): number {
  let size = 0
  if (/[a-z]/.test(pw)) size += 26
  if (/[A-Z]/.test(pw)) size += 26
  if (/\d/.test(pw)) size += 10
  if (/[а-я]/.test(pw)) size += 33
  if (/[А-Я]/.test(pw)) size += 33
  if (/[^a-zA-Zа-яА-Я0-9]/.test(pw)) size += 33
  return size || 1
}

// Shannon entropy of the empirical character distribution, in bits per symbol.
function shannonBitsPerSymbol(pw: string): number {
  const freq: Record<string, number> = {}
  for (const c of pw) freq[c] = (freq[c] || 0) + 1
  const len = pw.length
  let h = 0
  for (const k in freq) {
    const p = freq[k] / len
    h -= p * Math.log2(p)
  }
  return h
}

function hasRun(pw: string, minLen = 4): boolean {
  const low = pw.toLowerCase()
  for (const seq of KEYBOARD_RUNS) {
    for (let i = 0; i <= seq.length - minLen; i++) {
      const fragment = seq.slice(i, i + minLen)
      if (low.includes(fragment) || low.includes(reverse(fragment))) return true
    }
  }
  return false
}

function hasRepeat(pw: string, minLen = 3): boolean {
  return new RegExp(`(.)\\1{${minLen - 1},}`).test(pw)
}

function looksLikeYear(pw: string): boolean {
  // 19xx or 20xx as a substring — incredibly common suffix pattern.
  return /(19|20)\d{2}/.test(pw)
}

export type Score = 0 | 1 | 2 | 3 | 4

export interface PasswordStrength {
  /** Estimated entropy in bits, after pattern penalties. */
  entropy: number
  /** Normalised 0..4 score for UI bars. */
  score: Score
  /** Russian label for the score. */
  label: string
  /** Tailwind background class used to fill the meter segments. */
  color: string
  /** Human-readable estimated crack time at 1e10 guesses/sec (offline GPU). */
  crackTime: string
  /** Concrete reasons the score was capped, if any. */
  warnings: string[]
}

function formatCrackTime(entropyBits: number): string {
  // 10 billion guesses/sec ≈ a single high-end GPU on a fast hash.
  const guessesPerSec = 1e10
  const seconds = Math.pow(2, entropyBits) / (2 * guessesPerSec)
  if (!isFinite(seconds) || seconds > 1e15) return 'столетия'
  if (seconds < 1) return 'мгновенно'
  if (seconds < 60) return `${Math.round(seconds)} с`
  if (seconds < 3600) return `${Math.round(seconds / 60)} мин`
  if (seconds < 86400) return `${Math.round(seconds / 3600)} ч`
  if (seconds < 2592000) return `${Math.round(seconds / 86400)} дн`
  if (seconds < 31536000) return `${Math.round(seconds / 2592000)} мес`
  const years = seconds / 31536000
  if (years < 1000) return `${Math.round(years).toLocaleString('ru-RU')} лет`
  if (years < 1e6) return `${Math.round(years / 1000).toLocaleString('ru-RU')} тыс. лет`
  return 'миллионы лет'
}

const EMPTY: PasswordStrength = {
  entropy: 0,
  score: 0,
  label: 'Пусто',
  color: 'bg-c-bg3',
  crackTime: '—',
  warnings: [],
}

export function evaluatePassword(pw: string): PasswordStrength {
  if (!pw) return EMPTY

  const warnings: string[] = []

  if (TOP_PASSWORDS.has(pw.toLowerCase())) {
    return {
      entropy: 0,
      score: 0,
      label: 'В словаре утечек',
      color: 'bg-c-red',
      crackTime: 'мгновенно',
      warnings: ['Этот пароль есть в публичных списках'],
    }
  }

  const N = charsetSize(pw)
  // Take the smaller of "perfect charset entropy" and "actual symbol entropy" —
  // a 30-character "aaaaaaa…" should not score higher than its uniqueness allows.
  const perfectBits = pw.length * Math.log2(N)
  const empiricalBits = shannonBitsPerSymbol(pw) * pw.length
  let entropy = Math.min(perfectBits, empiricalBits + Math.log2(N))

  if (hasRepeat(pw)) {
    entropy *= 0.6
    warnings.push('Подряд идущие повторы символов')
  }
  if (hasRun(pw)) {
    entropy *= 0.55
    warnings.push('Клавиатурная или алфавитная последовательность')
  }
  if (looksLikeYear(pw)) {
    entropy *= 0.85
    warnings.push('Похоже на год — легко угадывается')
  }
  if (pw.length < 8) {
    entropy = Math.min(entropy, 24)
    warnings.push('Менее 8 символов')
  }

  entropy = Math.max(0, Math.min(128, entropy))

  let score: Score, label: string, color: string
  if (entropy < 28) {
    score = 0; label = 'Очень слабый'; color = 'bg-c-red'
  } else if (entropy < 40) {
    score = 1; label = 'Слабый'; color = 'bg-orange-500'
  } else if (entropy < 60) {
    score = 2; label = 'Средний'; color = 'bg-c-gold'
  } else if (entropy < 80) {
    score = 3; label = 'Сильный'; color = 'bg-c-green'
  } else {
    score = 4; label = 'Отличный'; color = 'bg-emerald-400'
  }

  return { entropy, score, label, color, crackTime: formatCrackTime(entropy), warnings }
}
