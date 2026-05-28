import { useParams } from "wouter";
import { useTitle } from "@/hooks/useTitle";
import { useUserByHandle, getCurrentUserId } from "@/lib/store";
import { ProfileView } from "@/components/profile/ProfileView";
import { ProfileShell, PROFILE_MUTED } from "@/components/profile/profile-ui";

export default function UserProfile() {
  const params = useParams<{ handle: string }>();
  const handle = params.handle ?? "";
  const { data: user } = useUserByHandle(handle);
  useTitle(user ? user.displayName : "Profile");

  const me = getCurrentUserId();
  const isOwnProfile = !!user && !!me && user.id === me;

  if (!user) {
    return (
      <ProfileShell>
        <div className="p-10 text-center font-['Inter']" style={{ color: PROFILE_MUTED }}>User not found.</div>
      </ProfileShell>
    );
  }

  return (
    <ProfileView user={user} isOwnProfile={isOwnProfile} />
  );
}
