"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { VanaDlpIntegration } from "../contribution/VanaDlpIntegration";
import { useUserData } from "./hooks/useUserData";

export function UserProfile() {
  const { userInfo, driveInfo, isLoading, error } = useUserData();

  if (isLoading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return (
      <Card className="w-full shadow-lg">
        <CardHeader>
          <CardTitle>Error</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <p className="text-sm text-gray-500 mt-2">
            Please try signing out and back in again. If the problem persists,
            please contact support.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* User Profile Card */}
      <Card className="w-full">
        <CardHeader className="flex flex-row items-center gap-4">
          <Avatar className="h-16 w-16 border">
            <AvatarImage src={userInfo?.picture} alt={userInfo?.name} />
            <AvatarFallback>{userInfo?.name?.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle>{userInfo?.name}</CardTitle>
            <CardDescription className="flex items-center gap-2">
              {userInfo?.email}
              {userInfo?.verifiedEmail && (
                <Badge
                  variant="outline"
                  className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                >
                  Verified
                </Badge>
              )}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">Google Drive Storage</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Used:</span>
                <span className="font-medium">
                  {driveInfo?.usedStorageBytes}
                </span>
              </div>
              <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${driveInfo?.percentUsed || 0}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total:</span>
                <span className="font-medium">
                  {driveInfo?.totalStorageBytes}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Account Information</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Google ID:</span>
                <span className="font-mono text-xs truncate max-w-[200px]">
                  {userInfo?.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Locale:</span>
                <span className="font-medium">
                  {userInfo?.locale || "Not available"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VANA DLP Integration */}
      <div className="mt-6">
        <VanaDlpIntegration />
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="flex flex-row items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-2 w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
