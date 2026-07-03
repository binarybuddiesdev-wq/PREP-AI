import { SignUp } from '@clerk/clerk-react';
import { Link } from 'react-router';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 font-bold text-xl text-white">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-black text-sm font-extrabold">
              P
            </div>
            PrepAI
          </Link>
        </div>
        <SignUp
          routing="path"
          path="/sign-up"
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-[#18181b] border border-white/10 shadow-xl',
            },
          }}
        />
        <p className="text-center text-sm text-zinc-500 mt-6">
          Already have an account?{' '}
          <Link to="/sign-in" className="text-amber-500 hover:text-amber-400 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
