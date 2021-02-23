import { config } from "https://deno.land/x/dotenv/mod.ts";
import { Application, Router, helpers } from "https://deno.land/x/oak/mod.ts";
import {
  DOMParser,
  Element,
} from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { parse } from "https://deno.land/std@0.88.0/flags/mod.ts";

const { args } = Deno;
const argPort = parse(args).port;

enum IJobType {
  full = "Full Time",
  part = "Part Time",
}

interface IJob {
  id: string;
  title: string;
  uri: string;
  type: IJobType;
  addedDate: Date;
  location: string;
  company: {
    logo: string;
    name: string;
  };
}

const router = new Router();
router.get("/api/jobs", async (ctx) => {
  const search = helpers.getQuery(ctx, { mergeParams: true });
  let query =
    "lang=&search_categories=&search_keywords=developer&search_location=&per_page=15&orderby=featured&order=DESC&page=2";
  if (Object.keys(search).length) {
    query = "";
    Object.keys(search).forEach((k, i) => {
      query += `${k}=${search[k]}`;
      query += "&";
    });
  }

  const res = await fetch("https://euremotejobs.com/jm-ajax/get_listings/", {
    headers: {
      accept: "*/*",
      "accept-language": "en-GB,en-US;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      pragma: "no-cache",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "XMLHttpRequest",
    },
    referrerPolicy: "strict-origin-when-cross-origin",
    body: query,
    method: "POST",
    credentials: "include",
  });

  const json = await res.json();

  const doc = new DOMParser().parseFromString(json.html, "text/html");
  const jobListNodes = doc!.querySelectorAll('li[id^="job_listing"]');
  const jobList: Array<IJob> = [];
  const parseDate = (str: string): Date => {
    let daysAgo = /\d+/.exec(str)![0];
    return new Date(new Date().setDate(new Date().getDate() - Number(daysAgo)));
  };
  const parseLocation = (str: string): string => {
    return /(?<=q=)\w+/.exec(str)![0];
  };

  const getJobType = (str: string) => {
    return str.toLocaleLowerCase().includes("full")
      ? IJobType.full
      : IJobType.part;
  };

  jobListNodes.forEach((el) => {
    const e = el as Element;
    const newJob = {
      id: e.id,
      title: e.getAttribute("data-title")!,
      uri: e.getAttribute("data-href")!,
      company: {
        logo: e.getElementsByTagName("img")[0].getAttribute("src")!,
        name: e.getElementsByTagName("img")[0].getAttribute("alt")!,
      },
      location: parseLocation(
        e.getElementsByClassName("google_map_link")[0].getAttribute("href")!
      ),
      addedDate: parseDate(
        e.getElementsByClassName("job_listing-date")[0].innerHTML!
      ),
      type: getJobType(
        e.getElementsByClassName("job_listing-type")[0].innerHTML!
      ),
    };

    jobList.push(newJob);
  });

  ctx.response.status = 200;
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.body = { success: true, jobs: jobList };
});

const app = new Application();
app.use(router.routes());
app.use(router.allowedMethods());

await app.listen({ port: Number(argPort) || Number(config().PORT) });
