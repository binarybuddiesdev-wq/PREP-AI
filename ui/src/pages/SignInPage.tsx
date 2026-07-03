import { SignIn } from '@clerk/clerk-react';
import { Link } from 'react-router';

export default function SignInPage() {
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
        <SignIn
          routing="path"
          path="/sign-in"
          appearance={{
            elements: {
              rootBox: 'mx-auto',
              card: 'bg-[#18181b] border border-white/10 shadow-xl',
            },
          }}
        />
        <p className="text-center text-sm text-zinc-500 mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/sign-up" className="text-amber-500 hover:text-amber-400 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
