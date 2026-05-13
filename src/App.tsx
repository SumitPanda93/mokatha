import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { useAuthState } from "@/lib/auth";
import { supabase, QK, useClaimDailyStreakAuto } from "@/lib/store";

// Mobile-shell pages
import Splash from "@/pages/splash";
import Onboarding from "@/pages/onboarding";
import Login from "@/pages/auth/login";
import Signup from "@/pages/auth/signup";
import ProfileSetup from "@/pages/auth/profile-setup";
import AuthCallback from "@/pages/auth/callback";
import Setup from "@/pages/setup";
import Home from "@/pages/home";
import Search from "@/pages/search";
import CreateHub from "@/pages/create";
import CreateVoice from "@/pages/create/voice";
import CreateText from "@/pages/create/text";
import CreateStory from "@/pages/create/story";
import CreateReel from "@/pages/create/reel";
import PostDetail from "@/pages/post-detail";
import PostEdit from "@/pages/post-edit";
import ReelsBrowse from "@/pages/reels";
import Profile from "@/pages/profile";
import UserProfile from "@/pages/user-profile";
import Followers from "@/pages/followers";
import Following from "@/pages/following";
import Wallet from "@/pages/wallet";
import WalletTransactions from "@/pages/wallet/transactions";
import Withdraw from "@/pages/wallet/withdraw";
import MehfilRoom from "@/pages/mehfil";
import MehfilHost from "@/pages/mehfil-host";
import MehfilList from "@/pages/mehfil-list";
import Trending from "@/pages/trending";
import Notifications from "@/pages/notifications";
import SettingsHome from "@/pages/settings";
import SettingsAccount from "@/pages/settings/account";
import SettingsPrivacy from "@/pages/settings/privacy";
import SettingsNotifs from "@/pages/settings/notifications";
import SettingsAbout from "@/pages/settings/about";
import Messages from "@/pages/messages";
import Rewards from "@/pages/rewards";
import CreatorPlan from "@/pages/creator-plan";
import CreatorEarnings from "@/pages/creator-earnings";
import PaymentResult from "@/pages/payment-result";
import NotFound from "@/pages/not-found";

// Admin
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminModeration from "@/pages/admin/moderation";
import AdminReported from "@/pages/admin/reported";
import AdminUsers from "@/pages/admin/users";
import AdminCreators from "@/pages/admin/creators";
import AdminEarnings from "@/pages/admin/earnings";
import AdminTxs from "@/pages/admin/transactions";
import AdminLive from "@/pages/admin/live";
import AdminAI from "@/pages/admin/ai";
import AdminPlatformSettings from "@/pages/admin/settings";
import AdminLogs from "@/pages/admin/logs";

// Layouts
import MobileShell from "@/components/layout/MobileShell";
import { AudioProvider } from "@/lib/audioContext";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import Landing from "@/pages/landing";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity } },
});

function withMobile(Comp: React.ComponentType<any>) {
  return function MobileWrapped() {
    return (
      <MobileShell>
        <Comp />
      </MobileShell>
    );
  };
}

// Stable module-level references — prevents form state reset on auth re-renders
const HomeRoute            = withMobile(Home);
const SearchRoute          = withMobile(Search);
const CreateHubRoute       = withMobile(CreateHub);
const CreateVoiceRoute     = withMobile(CreateVoice);
const CreateTextRoute      = withMobile(CreateText);
const CreateStoryRoute     = withMobile(CreateStory);
const CreateReelRoute      = withMobile(CreateReel);
const PostDetailRoute      = withMobile(PostDetail);
const PostEditRoute        = withMobile(PostEdit);
const ReelsRoute           = withMobile(ReelsBrowse);
const ProfileRoute         = withMobile(Profile);
const UserProfileRoute     = withMobile(UserProfile);
const FollowersRoute       = withMobile(Followers);
const FollowingRoute       = withMobile(Following);
const WalletRoute          = withMobile(Wallet);
const WalletTxRoute        = withMobile(WalletTransactions);
const WithdrawRoute        = withMobile(Withdraw);
const MehfilListRoute      = withMobile(MehfilList);
const TrendingRoute        = withMobile(Trending);
const NotificationsRoute   = withMobile(Notifications);
const MessagesRoute        = withMobile(Messages);
const RewardsRoute         = withMobile(Rewards);
const CreatorPlanRoute     = withMobile(CreatorPlan);
const CreatorEarningsRoute = withMobile(CreatorEarnings);
const SettingsHomeRoute    = withMobile(SettingsHome);
const SettingsAccountRoute = withMobile(SettingsAccount);
const SettingsPrivacyRoute = withMobile(SettingsPrivacy);
const SettingsNotifsRoute  = withMobile(SettingsNotifs);
const SettingsAboutRoute   = withMobile(SettingsAbout);
const NotFoundRoute        = withMobile(NotFound);

// Auth gate for the home route — renders Landing (no shell) for guests,
// HomeRoute (with MobileShell + nav) for authenticated users or guest-browse.
// sessionStorage persists the guest-browse choice within the tab session.
function HomeGate() {
  const { ready, user } = useAuthState();
  const [guestBrowse, setGuestBrowse] = useState(
    () => sessionStorage.getItem("mk-guest") === "1",
  );

  if (ready && !user && !guestBrowse) {
    return (
      <Landing
        onBrowse={() => {
          sessionStorage.setItem("mk-guest", "1");
          setGuestBrowse(true);
        }}
      />
    );
  }

  return <HomeRoute />;
}

function Router() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  const isAdmin = location.startsWith("/admin");
  const isFullScreen =
    location === "/splash" ||
    location === "/onboarding" ||
    location.startsWith("/auth") ||
    location.startsWith("/mehfil") ||
    isAdmin;

  return (
    <div className={isAdmin ? "min-h-[100dvh] w-full" : "min-h-[100dvh] w-full bg-[#E7E3DB] flex justify-center"}>
      {isAdmin ? (
        <Switch>
          <Route path="/admin" component={AdminLogin} />
          <Route path="/admin/login" component={AdminLogin} />
          <Route path="/admin/dashboard" component={AdminDashboard} />
          <Route path="/admin/moderation" component={AdminModeration} />
          <Route path="/admin/reported" component={AdminReported} />
          <Route path="/admin/users" component={AdminUsers} />
          <Route path="/admin/creators" component={AdminCreators} />
          <Route path="/admin/earnings" component={AdminEarnings} />
          <Route path="/admin/transactions" component={AdminTxs} />
          <Route path="/admin/live" component={AdminLive} />
          <Route path="/admin/ai" component={AdminAI} />
          <Route path="/admin/settings" component={AdminPlatformSettings} />
          <Route path="/admin/logs" component={AdminLogs} />
          <Route component={NotFound} />
        </Switch>
      ) : (
        <div className={isFullScreen ? "w-full max-w-[430px] min-h-[100dvh] bg-[#F5F3EF] relative shadow-2xl overflow-hidden flex flex-col" : "w-full max-w-[430px] min-h-[100dvh] bg-[#F5F3EF] relative shadow-2xl overflow-hidden flex flex-col"}>
          <Switch>
            {/* Auth & onboarding (no shell) */}
            <Route path="/splash" component={Splash} />
            <Route path="/onboarding" component={Onboarding} />
            <Route path="/login" component={Login} />
            <Route path="/signup" component={Signup} />
            <Route path="/auth/login" component={Login} />
            <Route path="/auth/signup" component={Signup} />
            <Route path="/auth/profile-setup" component={ProfileSetup} />
            <Route path="/auth/callback" component={AuthCallback} />
            <Route path="/setup" component={Setup} />

            {/* Mehfil rooms (full-bleed) */}
            <Route path="/mehfil/host/:id" component={MehfilHost} />
            <Route path="/mehfil/:id" component={MehfilRoom} />

            {/* Mobile shell pages — HomeGate handles Landing vs feed */}
            <Route path="/" component={HomeGate} />
            <Route path="/home" component={HomeGate} />
            <Route path="/search" component={SearchRoute} />
            <Route path="/trending" component={TrendingRoute} />
            <Route path="/notifications" component={NotificationsRoute} />

            {/* Create */}
            <Route path="/create" component={CreateHubRoute} />
            <Route path="/create/voice" component={CreateVoiceRoute} />
            <Route path="/create/text" component={CreateTextRoute} />
            <Route path="/create/story" component={CreateStoryRoute} />
            <Route path="/create/reel" component={CreateReelRoute} />

            {/* Post */}
            <Route path="/post/:id/edit" component={PostEditRoute} />
            <Route path="/post/:id" component={PostDetailRoute} />

            <Route path="/reels" component={ReelsRoute} />

            {/* Messages */}
            <Route path="/messages" component={MessagesRoute} />

            {/* Rewards & Creator Plan */}
            <Route path="/rewards" component={RewardsRoute} />
            <Route path="/creator-plan" component={CreatorPlanRoute} />

            {/* Profile + social */}
            <Route path="/me" component={ProfileRoute} />
            <Route path="/u/:handle/followers" component={FollowersRoute} />
            <Route path="/u/:handle/following" component={FollowingRoute} />
            <Route path="/u/:handle" component={UserProfileRoute} />

            {/* Mehfil hub */}
            <Route path="/mehfil" component={MehfilListRoute} />

            {/* Wallet */}
            <Route path="/wallet" component={WalletRoute} />
            <Route path="/wallet/transactions" component={WalletTxRoute} />
            <Route path="/wallet/withdraw" component={WithdrawRoute} />
            <Route path="/wallet/earnings" component={CreatorEarningsRoute} />
            <Route path="/creator-earnings" component={CreatorEarningsRoute} />
            <Route path="/payment-result" component={PaymentResult} />

            {/* Settings */}
            <Route path="/settings" component={SettingsHomeRoute} />
            <Route path="/settings/account" component={SettingsAccountRoute} />
            <Route path="/settings/privacy" component={SettingsPrivacyRoute} />
            <Route path="/settings/notifications" component={SettingsNotifsRoute} />
            <Route path="/settings/about" component={SettingsAboutRoute} />

            <Route component={NotFoundRoute} />
          </Switch>
        </div>
      )}
    </div>
  );
}

// Syncs Supabase auth session → profile row on every page load / session change.
// Also silently claims daily Ink-points streak once per calendar day.
function AuthSync() {
  const qc = useQueryClient();
  const { ready, user } = useAuthState();
  const claimStreak = useClaimDailyStreakAuto();

  useEffect(() => {
    if (!ready) return;
    if (!user) return;

    // Upsert profile with explicit created_at so the FK from posts is always satisfied.
    const ts = new Date().toISOString();
    supabase
      .from("profiles")
      .upsert(
        { id: user.id, email: user.email ?? null, phone: user.phone ?? null, created_at: ts, updated_at: ts },
        { onConflict: "id", ignoreDuplicates: false }
      )
      .then(({ error }) => {
        if (error) {
          console.error("[mk:AuthSync] profile upsert FAILED", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            userId: user.id,
          });
        } else {
          console.log("[mk:AuthSync] profile upserted for", user.id);
          qc.invalidateQueries({ queryKey: QK.currentUser });
          qc.invalidateQueries({ queryKey: QK.posts });
          // Auto-claim daily streak silently (no toast if already claimed)
          claimStreak.mutate(user.id);
        }
        return undefined;
      })
      .then(undefined, (e: unknown) => console.error("[mk:AuthSync] profile upsert exception", e));
  }, [qc, ready, user]);

  return null;
}

function App() {
  const routerBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  const { ready } = useAuthState();

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AudioProvider>
          <TooltipProvider>
            {!ready ? (
              <div className="min-h-[100dvh] w-full bg-[#E7E3DB] flex justify-center">
                <div className="w-full max-w-[430px] min-h-[100dvh] bg-[#F5F3EF] relative shadow-2xl overflow-hidden flex flex-col items-center justify-center">
                  <div className="text-[14px] text-[#6B6B6B] font-['Inter']">Loading Mo Katha…</div>
                </div>
              </div>
            ) : null}
            <WouterRouter base={routerBase}>
              <AuthSync />
              <Router />
            </WouterRouter>
            <Toaster />
            <SonnerToaster />
            <PWAInstallPrompt />
          </TooltipProvider>
        </AudioProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
