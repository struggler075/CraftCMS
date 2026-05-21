import { motion } from 'framer-motion'
import { ShieldCheck, ShieldAlert, Clock } from 'lucide-react'
import { evaluatePassword } from '../../utils/passwordStrength'

interface Props {
  password: string
  /** Show the row with crack-time estimate + warnings. Default true. */
  detailed?: boolean
}

export default function PasswordStrengthMeter({ password, detailed = true }: Props) {
  const strength = evaluatePassword(password)
  const { entropy, score, label, color, crackTime, warnings } = strength

  // 5-segment bar — segments fill left-to-right by score.
  const segments = [0, 1, 2, 3, 4]

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        {segments.map((i) => (
          <motion.div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= score ? color : 'bg-c-bg3'
            }`}
            initial={false}
            animate={{ opacity: i <= score ? 1 : 0.4 }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          {score >= 3 ? (
            <ShieldCheck className={`w-3.5 h-3.5 ${score >= 4 ? 'text-emerald-400' : 'text-c-green'}`} />
          ) : (
            <ShieldAlert className={`w-3.5 h-3.5 ${score === 0 ? 'text-c-red' : score === 1 ? 'text-orange-500' : 'text-c-gold'}`} />
          )}
          <span className={
            score === 0 ? 'text-c-red' :
            score === 1 ? 'text-orange-400' :
            score === 2 ? 'text-c-gold' :
            score === 3 ? 'text-c-green' :
            'text-emerald-400'
          }>
            {label}
          </span>
          {password && <span className="text-c-t3">· {Math.round(entropy)} бит</span>}
        </div>
        {detailed && password && (
          <span className="flex items-center gap-1 text-c-t3">
            <Clock className="w-3 h-3" />
            {crackTime}
          </span>
        )}
      </div>

      {detailed && (
        // Reserved single line so the form height stays constant whether or not
        // there's a warning to surface. Only the most relevant reason is shown.
        <div className="text-xs text-c-t3 h-4 leading-4 truncate">
          {password && warnings[0] ? warnings[0] : ''}
        </div>
      )}
    </div>
  )
}
