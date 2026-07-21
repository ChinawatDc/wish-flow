import { cookies } from "next/headers";

import { authErrorResponse, requireUser } from "@/lib/auth-helpers";
import { claimDeviceEvents } from "@/lib/auth-service";
import { DEVICE_TOKEN_COOKIE } from "@/lib/constants";
import { jsonOk } from "@/lib/http";

export async function POST() {
  try {
    const user = await requireUser();
    const jar = await cookies();
    const deviceToken = jar.get(DEVICE_TOKEN_COOKIE)?.value;
    if (!deviceToken) {
      return jsonOk({ claimed: 0, eventIds: [] });
    }

    const result = await claimDeviceEvents({
      userId: user.id,
      deviceToken,
    });
    return jsonOk(result);
  } catch (error) {
    return authErrorResponse(error);
  }
}
