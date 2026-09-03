"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Copy, 
  Check, 
  Terminal, 
  Layers, 
  Film, 
  Tv, 
  ExternalLink,
  Search,
  Sliders,
  FolderOpen,
  X,
  Plus,
  Trash2,
  Edit3,
  Save,
  HelpCircle,
  Clock,
  Settings,
  AlertCircle,
  Sparkles,
  CheckCircle,
  Globe,
  ArrowUpDown
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

// TypeScript interfaces
interface Episode {
  title: string;
  url: string;
  tvgLogo?: string;
  groupTitle?: string;
  tvgId?: string;
  userAgent?: string;
}

interface SeriesData {
  id: string;
  title: string;
  poster: string;
  episodes: Episode[];
  pageNum: number;
  synopsis?: string;
}

interface ScraperLog {
  timestamp: string;
  message: string;
  type: "info" | "success" | "warn" | "error";
}

// Helper to normalize and convert embed URLs to direct stream index.m3u8
const normalizeStreamUrl = (url: string): string => {
  if (!url) return "";
  let fixed = url.trim();
  if (fixed.startsWith("//")) {
    fixed = "https:" + fixed;
  }
  if (fixed.includes("getplay-cdn.com/embed/")) {
    fixed = fixed.replace(
      /(https?:\/\/)?getplay-cdn\.com\/embed\/([a-zA-Z0-9_-]+)[^\s"']*/,
      "https://getplay-cdn.com/api/stream/$2/index.m3u8"
    );
  }
  if (fixed.includes("24playerhd.com/embed/")) {
    fixed = fixed.replace(
      /(https?:\/\/)?([a-zA-Z0-9_-]+\.)?24playerhd\.com\/embed\/([a-zA-Z0-9_-]+)[^\s"']*/,
      "https://main.24playerhd.com/m3u8/$3/$3.m3u8"
    );
  }
  return fixed;
};

// Function to parse W3U JSON or Movie Array JSON format to SeriesData
const parseW3UContent = (jsonContent: any, extraFlagsEnabled: boolean): SeriesData[] => {
  const parsedCount: SeriesData[] = [];
  if (!jsonContent) return parsedCount;

  // Case 1: Array of Movie objects with `streams` or `episodes` (e.g., Doodii format)
  if (Array.isArray(jsonContent)) {
    jsonContent.forEach((movie: any, idx: number) => {
      const title = movie.title || movie.name || `รายการที่ ${idx + 1}`;
      const poster = movie.poster || movie.image || "https://picsum.photos/seed/movie-json/300/450";
      const cleanGroup = title.replace(/\+/g, "").substring(0, 60);

      const rawStreams = movie.streams || movie.episodes || [];
      const episodes: Episode[] = [];

      if (Array.isArray(rawStreams)) {
        rawStreams.forEach((stream: any) => {
          const epName = stream.episode_name || stream.title || "Episode";
          let url = stream.original_url || stream.stream_url || stream.url || "";
          url = normalizeStreamUrl(url);
          if (!url) return;

          episodes.push({
            title: `${title} ${epName}`,
            url: url,
            tvgId: movie.movie_id || "",
            tvgLogo: poster,
            groupTitle: cleanGroup,
            userAgent: "",
          } as any);
        });
      }

      if (episodes.length > 0) {
        parsedCount.push({
          id: movie.movie_id || `movie-json-${idx}-${Date.now()}`,
          title: title,
          poster: poster,
          episodes: episodes,
          pageNum: 1,
          synopsis: `ภาพยนตร์/ซีรีส์ JSON | จำนวนตอน: ${episodes.length}`
        });
      }
    });

    return parsedCount;
  }

  // Case 2: W3U Format with `.groups`
  if (Array.isArray(jsonContent.groups)) {
    const groups = jsonContent.groups;
    const groupedDirectStations: { [key: string]: any[] } = {};

    groups.forEach((group: any, idx: number) => {
      if (group.stations && Array.isArray(group.stations)) {
        const groupTitle = group.name || `กลุ่มที่ ${idx + 1}`;
        const episodes: Episode[] = [];
        
        group.stations.forEach((station: any) => {
          const url = normalizeStreamUrl(station.url);
          if (!url) return;
          
          episodes.push({
            title: station.name || "ช่องนิรนาม",
            url: url,
            tvgId: station.epgId || "",
            tvgLogo: station.image || "",
            userAgent: station.userAgent || "",
            groupTitle: groupTitle,
          } as any);
        });

        if (episodes.length > 0) {
          parsedCount.push({
            id: `w3u-group-${idx}-${groupTitle.replace(/[^a-zA-Z0-9\u0e00-\u0e7f]/g, "-")}`,
            title: groupTitle,
            poster: group.image || (episodes[0] as any).tvgLogo || "https://picsum.photos/seed/w3u-group/300/450",
            episodes: episodes,
            pageNum: 1,
            synopsis: `หมวดหมู่ W3U: ${groupTitle} | จำนวนช่องสถานี: ${episodes.length}`
          });
        }
      } else {
        const url = normalizeStreamUrl(group.url);
        if (url) {
          const groupTitle = group.title || "ทั่วไป";
          if (!groupedDirectStations[groupTitle]) {
            groupedDirectStations[groupTitle] = [];
          }
          groupedDirectStations[groupTitle].push({
            title: group.name || "ช่องนิรนาม",
            url: url,
            tvgId: group.epgId || "",
            tvgLogo: group.image || "",
            userAgent: group.userAgent || "",
            groupTitle: groupTitle,
          });
        }
      }
    });

    Object.keys(groupedDirectStations).forEach((groupTitle, idx) => {
      const list = groupedDirectStations[groupTitle];
      const episodes: Episode[] = list.map((item) => ({
        title: item.title,
        url: item.url,
        tvgId: item.tvgId,
        tvgLogo: item.tvgLogo,
        userAgent: item.userAgent,
        groupTitle: item.groupTitle
      } as any));

      parsedCount.push({
        id: `w3u-direct-${idx}-${groupTitle.replace(/[^a-zA-Z0-9\u0e00-\u0e7f]/g, "-")}`,
        title: groupTitle,
        poster: episodes[0] ? (episodes[0] as any).tvgLogo : "https://picsum.photos/seed/w3u-direct/300/450",
        episodes: episodes,
        pageNum: 1,
        synopsis: `สถานีทั่วไปกลุ่ม: ${groupTitle} | จำนวนช่องสัญญาณ: ${episodes.length}`
      });
    });
  }

  return parsedCount;
};

// Episode title parser to extract season and episode numbers for correct hierarchy ordering
const parseEpisodeTitle = (title: string, index: number) => {
  const normalized = title.toLowerCase();
  
  // Find Season: s1, ss2, season 3, ซีซั่น 4, ซีซัน 5, ภาค 2, ss02 across standard and Thai notations
  let seasonNum = 1;
  const seasonRegexes = [
    /season[\s._-]*(\d+)/i, // season 1, season-02, season.3
    /(?:^|[^a-z0-9])s(?:s)?[\s._-]*(\d+)(?:[e|ep|ตอน|\s._-]|$)/i, // S01E02, S1 EP2, SS2-EP1
    /[sS]{1,2}\s*(\d+)/, // ss1, s1, ss01, s01
    /ซีซั่น[\s._-]*(\d+)/i, // ซีซั่น 1, ซีซั่น 2
    /ซีซัน[\s._-]*(\d+)/i, // ซีซัน 1, ซีซัน 2
    /ภาค[\s._-]*(\d+)/i, // ภาค 1, ภาค 2
  ];
  for (const regex of seasonRegexes) {
    const match = normalized.match(regex);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        seasonNum = parsed;
        break;
      }
    }
  }

  // Find Episode number: ep1, ep.2, ep 03, ตอนที่ 4, ตอน 5, or trailing digits
  let epNum = index + 1;
  const epRegexes = [
    /ep(?:isode)?\.?\s*(\d+)/, // ep1, ep.1, episode 1, ep 01
    /ตอนที่\s*(\d+)/, // ตอนที่ 1
    /ตอน\s*(\d+)/, // ตอน 1
    /\s(\d+)\s/, // space number space
    /[-_]\s*(\d+)/, // - 1, _1
    /(\d+)$/ // digits at the end of string
  ];
  for (const regex of epRegexes) {
    const match = normalized.match(regex);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed)) {
        epNum = parsed;
        break;
      }
    }
  }

  return { seasonNum, epNum };
};

// External pure helpers for async delay and ID generation
const delayAsync = async (ms: number, shouldStopRef: React.RefObject<boolean>, isPausedRef: React.RefObject<boolean>) => {
  const startTime = Date.now();
  while (Date.now() - startTime < ms) {
    if (shouldStopRef.current) break;
    if (isPausedRef.current) {
      await new Promise((r) => setTimeout(r, 100));
      continue;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
};

const generateFallbackId = (prefix: string): string => {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

const fetchWithTiming = async (url: string, options?: RequestInit) => {
  const start = performance.now();
  const res = await fetch(url, options);
  const duration = Math.round(performance.now() - start);
  return { res, duration };
};

export default function SeriesHarvesterPage() {
  // Scraper controls
  // Active Harvester Tab Selection
  const [activeTab, setActiveTab] = useState<"okserietv" | "kubhd24" | "123hdtv" | "doonang" | "ezmovie" | "wowdrama" | "seriedays" | "24hd" | "ddnung" | "moviesdoofree" | "w3u" | "proxy">("okserietv");

  // MoviesDooFree Scraper states & inputs
  const [baseUrlMoviesDooFree, setBaseUrlMoviesDooFree] = useState<string>("https://moviesdoofree.com/");
  const [startPageMoviesDooFree, setStartPageMoviesDooFree] = useState<number>(1);
  const [endPageMoviesDooFree, setEndPageMoviesDooFree] = useState<number>(1);
  const [seriesListMoviesDooFree, setSeriesListMoviesDooFree] = useState<SeriesData[]>([]);

  // Proxy Tester States
  const [proxyTargetUrl, setProxyTargetUrl] = useState<string>("https://wow-drama.com/");
  const [proxyReferer, setProxyReferer] = useState<string>("https://wow-drama.com/");
  const [proxyTestResult, setProxyTestResult] = useState<string>("");
  const [proxyStatus, setProxyStatus] = useState<string | null>(null);
  const [isTestingProxy, setIsTestingProxy] = useState<boolean>(false);

  // W3U Converter States
  const [seriesListW3u, setSeriesListW3u] = useState<SeriesData[]>([]);
  const [w3uRawText, setW3uRawText] = useState<string>("");
  const [w3uExtraFlags, setW3uExtraFlags] = useState<boolean>(false);
  const [w3uIsDragging, setW3uIsDragging] = useState<boolean>(false);

  // Multi-selection state for series deletion
  const [selectedSeriesIds, setSelectedSeriesIds] = useState<string[]>([]);

  const handleSwitchTab = (tab: typeof activeTab) => {
    setActiveTab(tab);
    handleSelectSeries(null);
    setSelectedSeriesIds([]);
  };

  // Scraper controls (KubHD24 / OKSerieTV)
  const [startPage, setStartPage] = useState<number>(1);
  const [endPage, setEndPage] = useState<number>(2);
  const [delayMs, setDelayMs] = useState<number>(1000); // 1s default cooldown to avoid rate limit
  const [clearPrevious, setClearPrevious] = useState<boolean>(true);

  // 123HDTV Scraper states & inputs
  const [scrapperMode123, setScrapperMode123] = useState<"category" | "single_post">("category");
  const [categoryUrl123, setCategoryUrl123] = useState<string>("https://www.123-hdx.com/%e0%b8%ab%e0%b8%99%e0%b8%b1%e0%b8%87%e0%b9%83%e0%b8%ab%e0%b8%a1%e0%b9%88-2026");
  const [categoryType123, setCategoryType123] = useState<string>("https://www.123-hdx.com/%e0%b8%ab%e0%b8%99%e0%b8%b1%e0%b8%87%e0%b9%83%e0%b8%ab%e0%b8%a1%e0%b9%88-2026");
  const [startPage123, setStartPage123] = useState<number>(1);
  const [endPage123, setEndPage123] = useState<number>(1);
  const [separateMoviesAndSeries123, setSeparateMoviesAndSeries123] = useState<boolean>(true);
  const [generatedM3U123, setGeneratedM3U123] = useState<string>("");
  const [generatedW3U123, setGeneratedW3U123] = useState<string>("");
  const [generatedM3U123Name, setGeneratedM3U123Name] = useState<string>("123-hd_playlist.m3u");
  const [generatedW3U123Name, setGeneratedW3U123Name] = useState<string>("123-hd_playlist.w3u");
  const [postId123, setPostId123] = useState<number>(181920);
  const [nonce123, setNonce123] = useState<string>("f597124a37");
  const [totalEpisodes123, setTotalEpisodes123] = useState<number>(6);
  const [title123, setTitle123] = useState<string>("A Knight of the Seven Kingdoms");
  const [slug123, setSlug123] = useState<string>("a-lover-in-the-mortal-world");
  const [poster123, setPoster123] = useState<string>("https://parser-xi.vercel.app/wp-content/uploads/2026/01/A-Knight-of-the-Seven-Kingdoms-2026-300x450.jpg");
  const [synopsis123, setSynopsis123] = useState<string>("Genres: ซีรี่ย์ซับไทย, ซีรี่ย์ใหม่ 2026, ซีรี่ย์พากย์ไทย, ซีรี่ย์ฝรั่ง, Action บู๊, Drama ชีวิต, Fantasy แฟนตาซี");
  const [seriesList123, setSeriesList123] = useState<SeriesData[]>([]);



  // WOW-Drama Scraper states & inputs
  const [categoryUrlWow, setCategoryUrlWow] = useState<string>("https://wow-drama.com/category/the-series-th/");
  const [startPageWow, setStartPageWow] = useState<number>(1);
  const [endPageWow, setEndPageWow] = useState<number>(3);
  const [skipUnfinishedWow, setSkipUnfinishedWow] = useState<boolean>(false);
  const [seriesListWow, setSeriesListWow] = useState<SeriesData[]>([]);

  // SerieDays Scraper states & inputs
  const [categoryUrlSerieDays, setCategoryUrlSerieDays] = useState<string>("https://www.seriedays.com/%E0%B8%8B%E0%B8%B5%E0%B8%A3%E0%B8%B5%E0%B9%88%E0%B8%A2%E0%B9%8C%E0%B8%9E%E0%B8%B2%E0%B8%81%E0%B8%A2%E0%B9%8C%E0%B9%84%E0%B8%97%E0%B8%A2/");
  const [startPageSerieDays, setStartPageSerieDays] = useState<number>(1);
  const [endPageSerieDays, setEndPageSerieDays] = useState<number>(2);
  const [seriesListSerieDays, setSeriesListSerieDays] = useState<SeriesData[]>([]);

  // 24HD Scraper states & inputs
  const [categoryUrl24HD, setCategoryUrl24HD] = useState<string>("https://www.24hd.vip/category/netflix/");
  const [startPage24HD, setStartPage24HD] = useState<number>(1);
  const [endPage24HD, setEndPage24HD] = useState<number>(3);
  const [seriesList24HD, setSeriesList24HD] = useState<SeriesData[]>([]);

  // DDNUNG Scraper states & inputs
  const [categoryUrlDDNung, setCategoryUrlDDNung] = useState<string>("https://ddnung.com/series-country/korean-series/");
  const [startPageDDNung, setStartPageDDNung] = useState<number>(1);
  const [endPageDDNung, setEndPageDDNung] = useState<number>(3);
  const [seriesListDDNung, setSeriesListDDNung] = useState<SeriesData[]>([]);


  // DooNang Scraper states & inputs
  const [doonangFetchMode, setDoonangFetchMode] = useState<"movie_id" | "tag" | "show_id" | "category">("movie_id");
  const [doonangMovieId, setDoonangMovieId] = useState<string>("1234");
  const [doonangTagValue, setDoonangTagValue] = useState<string>("japan");
  const [doonangShowId, setDoonangShowId] = useState<string>("1234");
  const [doonangResultM3U, setDoonangResultM3U] = useState<string>("");
  const [doonangResultJSON, setDoonangResultJSON] = useState<string>("");
  const [pageDoonang, setPageDoonang] = useState<number>(1);
  const [limitDoonang, setLimitDoonang] = useState<number>(24);
  const [seriesListDoonang, setSeriesListDoonang] = useState<SeriesData[]>([]);

  // EzMovie Scraper states & inputs
  const [ezCategoryType, setEzCategoryType] = useState<string>("/movies/หนังมาใหม่");
  const [ezCategory, setEzCategory] = useState<string>("/movies/หนังมาใหม่");
  const [ezStartPage, setEzStartPage] = useState<number>(1);
  const [ezEndPage, setEzEndPage] = useState<number>(2);
  const [seriesListEz, setSeriesListEz] = useState<SeriesData[]>([]);

  // Scraper runtime states
  const [isHarvesting, setIsHarvesting] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentProgress, setCurrentProgress] = useState<{
    page: number;
    seriesIndex: number;
    totalSeriesInPage: number;
    currentSeriesName: string;
  }>({
    page: 1,
    seriesIndex: 0,
    totalSeriesInPage: 0,
    currentSeriesName: "",
  });

  const [seriesList, setSeriesList] = useState<SeriesData[]>([]);
  const [logs, setLogs] = useState<ScraperLog[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedSeries, setSelectedSeries] = useState<SeriesData | null>(null);
  const [episodeSortBy, setEpisodeSortBy] = useState<"oldest" | "newest" | "season">("oldest");
  const [selectedSeasonFilter, setSelectedSeasonFilter] = useState<number | "all">("all");

  // EP Add/Edit/Delete Management States & Actions
  const [showAddEpForm, setShowAddEpForm] = useState<boolean>(false);
  const [inputEpTitle, setInputEpTitle] = useState<string>("");
  const [inputEpUrl, setInputEpUrl] = useState<string>("");
  const [editingEpIndex, setEditingEpIndex] = useState<number | null>(null);

  const handleSelectSeries = (series: SeriesData | null) => {
    setActiveEpisode(null);
    setEpisodeSortBy("oldest"); // Reset sorting when changing or closing series
    setSelectedSeasonFilter("all"); // Reset season filter when changing or closing series
    setShowAddEpForm(false);
    setInputEpTitle("");
    setInputEpUrl("");
    setEditingEpIndex(null);
    setSelectedSeries(series);
  };

  const updateSelectedSeriesEpisodes = (newEpisodes: Episode[]) => {
    if (!selectedSeries) return;

    const updatedSeries: SeriesData = {
      ...selectedSeries,
      episodes: newEpisodes
    };

    setSelectedSeries(updatedSeries);

    const updateList = (prev: SeriesData[]) =>
      prev.map((item) => (item.id === selectedSeries.id ? updatedSeries : item));

    if (activeTab === "okserietv" || activeTab === "kubhd24") setSeriesList(updateList);
    else if (activeTab === "123hdtv") setSeriesList123(updateList);
    else if (activeTab === "doonang") setSeriesListDoonang(updateList);
    else if (activeTab === "ezmovie") setSeriesListEz(updateList);
    else if (activeTab === "wowdrama") setSeriesListWow(updateList);
    else if (activeTab === "seriedays") setSeriesListSerieDays(updateList);
    else if (activeTab === "24hd") setSeriesList24HD(updateList);
    else if (activeTab === "ddnung") setSeriesListDDNung(updateList);
    else if (activeTab === "w3u") setSeriesListW3u(updateList);
  };

  const handleSaveEpisode = () => {
    if (!selectedSeries) return;
    if (!inputEpUrl.trim()) {
      addLog("⚠️ กรุณาระบุ URL ของตอน (EP)", "warn");
      return;
    }

    const normalizedUrl = normalizeStreamUrl(inputEpUrl.trim());
    const defaultTitle = `ตอนที่ ${selectedSeries.episodes.length + 1} (EP${String(selectedSeries.episodes.length + 1).padStart(2, "0")})`;
    const titleToUse = inputEpTitle.trim() || defaultTitle;

    if (editingEpIndex !== null) {
      const updated = [...selectedSeries.episodes];
      updated[editingEpIndex] = {
        title: titleToUse,
        url: normalizedUrl
      };
      updateSelectedSeriesEpisodes(updated);
      addLog(`✏️ บันทึกการแก้ไขตอน: ${titleToUse}`, "success");
    } else {
      const lines = inputEpUrl.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        const newEps: Episode[] = lines.map((line, idx) => {
          if (line.includes("|")) {
            const [t, u] = line.split("|").map(s => s.trim());
            return {
              title: t || `ตอนที่ ${selectedSeries.episodes.length + idx + 1}`,
              url: normalizeStreamUrl(u)
            };
          }
          return {
            title: `ตอนที่ ${selectedSeries.episodes.length + idx + 1} (EP${String(selectedSeries.episodes.length + idx + 1).padStart(2, "0")})`,
            url: normalizeStreamUrl(line)
          };
        });
        updateSelectedSeriesEpisodes([...selectedSeries.episodes, ...newEps]);
        addLog(`➕ เพิ่มตอนใหม่ ${newEps.length} ตอน ในซีรีส์ "${selectedSeries.title}"`, "success");
      } else {
        const newEp: Episode = {
          title: titleToUse,
          url: normalizedUrl
        };
        updateSelectedSeriesEpisodes([...selectedSeries.episodes, newEp]);
        addLog(`➕ เพิ่มตอนใหม่: ${titleToUse}`, "success");
      }
    }

    setInputEpTitle("");
    setInputEpUrl("");
    setEditingEpIndex(null);
    setShowAddEpForm(false);
  };

  const handleStartEditEpisode = (ep: Episode, index: number) => {
    setEditingEpIndex(index);
    setInputEpTitle(ep.title);
    setInputEpUrl(ep.url);
    setShowAddEpForm(true);
  };

  const handleDeleteEpisode = (index: number) => {
    if (!selectedSeries) return;
    const epToDelete = selectedSeries.episodes[index];
    const updated = selectedSeries.episodes.filter((_, i) => i !== index);
    updateSelectedSeriesEpisodes(updated);
    addLog(`🗑️ ลบตอน ${epToDelete?.title || `#${index + 1}`} เรียบร้อยแล้ว`, "info");
    if (activeEpisode?.index === index) {
      setActiveEpisode(null);
    }
  };

  // Available seasons in the selected series
  const availableSeasons = useMemo(() => {
    if (!selectedSeries || selectedSeries.episodes.length === 0) return [];
    const seasonMap = new Map<number, number>();
    selectedSeries.episodes.forEach((ep, originalIdx) => {
      const { seasonNum } = parseEpisodeTitle(ep.title, originalIdx);
      seasonMap.set(seasonNum, (seasonMap.get(seasonNum) || 0) + 1);
    });
    return Array.from(seasonMap.entries())
      .map(([seasonNum, count]) => ({ seasonNum, count }))
      .sort((a, b) => a.seasonNum - b.seasonNum);
  }, [selectedSeries]);

  const sortedEpisodesWithIndex = useMemo(() => {
    if (!selectedSeries) return [];

    let items = selectedSeries.episodes.map((ep, originalIdx) => {
      const parsed = parseEpisodeTitle(ep.title, originalIdx);
      return {
        ep,
        originalIdx,
        seasonNum: parsed.seasonNum,
        epNum: parsed.epNum
      };
    });

    // Apply season selection filter
    if (selectedSeasonFilter !== "all") {
      items = items.filter((item) => item.seasonNum === selectedSeasonFilter);
    }

    if (episodeSortBy === "newest") {
      items.sort((a, b) => b.originalIdx - a.originalIdx);
    } else if (episodeSortBy === "season") {
      items.sort((a, b) => {
        if (a.seasonNum !== b.seasonNum) {
          return a.seasonNum - b.seasonNum;
        }
        if (a.epNum !== b.epNum) {
          return a.epNum - b.epNum;
        }
        return a.originalIdx - b.originalIdx;
      });
    } else {
      items.sort((a, b) => a.originalIdx - b.originalIdx);
    }

    return items;
  }, [selectedSeries, episodeSortBy, selectedSeasonFilter]);

  const sortedEpisodesOfSelectedSeries = useMemo(() => {
    return sortedEpisodesWithIndex.map(item => item.ep);
  }, [sortedEpisodesWithIndex]);

  // Group episodes by season for visual hierarchy in Modal
  const groupedEpisodesBySeason = useMemo(() => {
    if (!sortedEpisodesOfSelectedSeries || sortedEpisodesOfSelectedSeries.length === 0) {
      return { hasMultipleSeasons: false, seasonGroups: [], seasonsList: [] };
    }

    const itemsWithSeason = sortedEpisodesOfSelectedSeries.map((ep, idx) => {
      const { seasonNum, epNum } = parseEpisodeTitle(ep.title, idx);
      return { ep, sortedIndex: idx, seasonNum, epNum };
    });

    const seasonMap = new Map<number, typeof itemsWithSeason>();
    itemsWithSeason.forEach((item) => {
      if (!seasonMap.has(item.seasonNum)) {
        seasonMap.set(item.seasonNum, []);
      }
      seasonMap.get(item.seasonNum)!.push(item);
    });

    const seasonsList = Array.from(seasonMap.keys()).sort((a, b) => {
      if (episodeSortBy === "newest") return b - a;
      return a - b;
    });

    const hasMultipleSeasons = seasonsList.length > 1;

    const seasonGroups = seasonsList.map((seasonNum) => ({
      seasonNum,
      items: seasonMap.get(seasonNum)!,
    }));

    return { hasMultipleSeasons, seasonGroups, seasonsList };
  }, [sortedEpisodesOfSelectedSeries, episodeSortBy]);

  const sortedSeriesForM3U = useMemo(() => {
    if (!selectedSeries) return null;
    return {
      ...selectedSeries,
      episodes: sortedEpisodesOfSelectedSeries
    };
  }, [selectedSeries, sortedEpisodesOfSelectedSeries]);
  
  // Settings panel toggle
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Target categories & paths
  const [categoryType, setCategoryType] = useState<string>("https://okserietv.com/category/watch-series/");
  const [categoryUrl, setCategoryUrl] = useState<string>("https://okserietv.com/category/watch-series/");

  // Active episode chosen for the player
  const [activeEpisode, setActiveEpisode] = useState<{ title: string; url: string; index: number } | null>(null);

  // Player refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<any>(null);

  // Clean up and load player on activeEpisode change
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeEpisode) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamUrl = activeEpisode.url;

    import("hls.js").then((M) => {
      const HlsClass = M.default;
      if (HlsClass.isSupported()) {
        const hls = new HlsClass({
          maxMaxBufferLength: 10,
          enableWorker: true,
          lowLatencyMode: true
        });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
          video.play().catch((err) => console.log("Autoplay blocked:", err));
        });
        hls.on(HlsClass.Events.ERROR, (event: any, data: any) => {
          if (data.fatal) {
            switch (data.type) {
              case HlsClass.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case HlsClass.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                break;
            }
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = streamUrl;
        video.addEventListener("loadedmetadata", () => {
          video.play().catch((err) => console.log("Autoplay blocked:", err));
        });
      }
    }).catch(err => {
      console.error("Hls load error:", err);
    });

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [activeEpisode]);

  // Safe reference flags to handle pausing and stopping asynchronously
  const isHarvestingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const shouldStopRef = useRef<boolean>(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Sync state with refs to allow thread-safe reading during long async loops
  useEffect(() => {
    isHarvestingRef.current = isHarvesting;
    isPausedRef.current = isPaused;
  }, [isHarvesting, isPaused]);

  // Keep terminal scrolled to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Helper: append real-time log
  const addLog = (message: string, type: "info" | "success" | "warn" | "error" = "info") => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString("th-TH", { hour12: false });
    setLogs((prev) => [...prev, { timestamp, message, type }]);
  };

  // Helper: Sleep function that respects pause & stop
  const waitState = async (ms: number) => {
    await delayAsync(ms, shouldStopRef, isPausedRef);
  };

  // Core Request Helper to bypass CORS
  const fetchProxy = async (url: string, isJson = false) => {
    try {
      const proxyUrl = `/api/123hd?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) {
        addLog(`เซิร์ฟเวอร์ตอบกลับสถานะล้มเหลว: ${res.status} สำหรับ URL: ${url}`, "error");
        return null;
      }
      return isJson ? await res.json() : await res.text();
    } catch (e: any) {
      addLog(`เกิดข้อผิดพลาดในการเชื่อมต่อผ่าน Proxy: ${e.message || e}`, "error");
      return null;
    }
  };

  // Resolve direct stream playlist file from post_id
  const getStreamUrl = async (postId: string, titleHint: string): Promise<string | null> => {
    const endpoint = `https://okserietv.com/wp-admin/admin-ajax.php?action=mix_get_player&post_id=${postId}`;
    const json = await fetchProxy(endpoint, true);
    if (!json || !json.success) {
      addLog(`[${titleHint}] ไม่มีข้อมูลผู้เล่นแบบอะซิงก์หรือล้มเหลว`, "warn");
      return null;
    }

    const playerHtml = json.player || "";
    const match = playerHtml.match(/data-src=["']([^"']+)["']/);
    if (!match) {
      addLog(`[${titleHint}] ค้นหารูปแบบวิดีโอ (data-src) ไม่พบ`, "warn");
      return null;
    }

    const srcUrl = match[1];
    // Resolve clean ID
    const segments = srcUrl.split("/").filter(Boolean);
    const id = segments.length > 0 ? segments[segments.length - 1] : "";

    if (id) {
      return `https://media.vdohls.com/${id}/playlist.m3u8`;
    }
    return null;
  };

  // Scrape single series page detail (KubHD24)
  const parseSeriesDetail = async (seriesId: string, pageNum: number): Promise<SeriesData | null> => {
    const url = `https://okserietv.com/series/${seriesId}/`;
    const html = await fetchProxy(url);
    if (!html) {
      addLog(`ไม่สามารถโหลดหน้าซีรีย์: ${seriesId}`, "error");
      return null;
    }

    // Process using client-side DOM Parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const title = doc.querySelector("h1")?.textContent?.trim() || seriesId;
    
    // Find poster image
    const imgEl = doc.querySelector("img.wp-post-image") || doc.querySelector(".poster img") || doc.querySelector("img");
    let poster = imgEl?.getAttribute("data-src") || imgEl?.getAttribute("src") || "";
    
    // Fallback logic
    if (poster && poster.startsWith("//")) {
      poster = "https:" + poster;
    }
    if (!poster) {
      poster = `https://picsum.photos/seed/${seriesId}/300/440`;
    }

    // Find episodes buttons
    const epButtons = doc.querySelectorAll("#eplist button.ep");
    if (epButtons.length === 0) {
      addLog(`[${title}] ไม่พบปุ่มอีพีใดๆ ในหน้านี้`, "warn");
      return null;
    }

    addLog(`[${title}] พบทั้งหมด ${epButtons.length} ตอน กำลังประมวลผลลิงก์สตรีมมิ่ง...`, "info");
    
    const episodes: Episode[] = [];
    for (let i = 0; i < epButtons.length; i++) {
      if (shouldStopRef.current) break;
      
      const btn = epButtons[i];
      const epTitle = btn.textContent?.trim() || `ตอนที่ ${i + 1}`;
      const postId = btn.id;

      if (!postId) continue;

      // Small delay per stream call to avoid hammer limits
      await waitState(200);

      const url = await getStreamUrl(postId, `${title} - ${epTitle}`);
      if (url) {
        episodes.push({ title: epTitle, url });
      }
    }

    return {
      id: seriesId,
      title,
      poster,
      episodes,
      pageNum
    };
  };

  // Main scraper orchestrator (KubHD24)
  const startHarvesting = async () => {
    if (isHarvesting) return;

    // Reset cancellation/stop trigger
    shouldStopRef.current = false;
    setIsHarvesting(true);
    setIsPaused(false);

    if (clearPrevious) {
      setSeriesList([]);
      setLogs([]);
    }

    addLog(`🚀 เริ่มดึงข้อมูลจากหน้า ${startPage} ถึง ${endPage}... (หน่วงเวลา: ${delayMs}ms)`, "success");

    let totalSeriesFound = 0;
    const baseCategoryUrl = categoryUrl.endsWith("/") ? categoryUrl : `${categoryUrl}/`;

    for (let p = startPage; p <= endPage; p++) {
      if (shouldStopRef.current) break;

      const pageUrl = p === 1 ? baseCategoryUrl : `${baseCategoryUrl}page/${p}/`;
      addLog(`🔍 กำลังแสกนหน้าสารบัญที่ ${p}... [URL: ${pageUrl}]`, "info");

      setCurrentProgress((prev) => ({
        ...prev,
        page: p,
        seriesIndex: 0,
        totalSeriesInPage: 0,
        currentSeriesName: "กำลังสแกนรายชื่อซีรีย์...",
      }));

      const catHtml = await fetchProxy(pageUrl);
      if (!catHtml) {
        addLog(`⚠️ ไม่สามารถดึงหน้าสารบัญที่ ${p} ได้ ข้ามเนื้อหานี้`, "error");
        continue;
      }

      // Regex matching to parse all series slugs
      const regex = /href="https:\/\/kubhd24\.net\/series\/([^"\/]+)\//g;
      const parsedIds = Array.from(new Set([...catHtml.matchAll(regex)].map((m) => m[1])))
        .filter((id) => id !== "series");

      if (parsedIds.length === 0) {
        addLog(`⚠️ ไม่พบซีรีย์ใดๆ ในหน้าสารบัญที่ ${p}`, "warn");
        continue;
      }

      addLog(`พบซีรีย์จำนวน ${parsedIds.length} เรื่อง ในหน้า ${p}`, "success");
      
      setCurrentProgress((prev) => ({
        ...prev,
        totalSeriesInPage: parsedIds.length,
      }));

      for (let i = 0; i < parsedIds.length; i++) {
        if (shouldStopRef.current) break;

        const seriesId = parsedIds[i];
        setCurrentProgress((prev) => ({
          ...prev,
          seriesIndex: i + 1,
          currentSeriesName: seriesId,
        }));

        addLog(`[${i + 1}/${parsedIds.length}] ขอดึงข้อมูลเรื่อง: '${seriesId}'...`, "info");

        const data = await parseSeriesDetail(seriesId, p);
        
        if (data && data.episodes.length > 0) {
          setSeriesList((prev) => {
            // Avoid duplicate series ids
            const filtered = prev.filter((item) => item.id !== data.id);
            return [...filtered, data];
          });
          totalSeriesFound++;
          addLog(`✅ บันทึกซีรีย์สำเร็จ: '${data.title}' มี ${data.episodes.length} ตอน`, "success");
        } else {
          addLog(`❌ ดึงข้อมูลสำหรับซีรีย์ล้มเหลว หรือไม่พบตอนย่อย: '${seriesId}'`, "warn");
        }

        // Custom timeout interval after single complete series load to prevent blacklisting
        if (i < parsedIds.length - 1) {
          addLog(`💤 ระงับระบบรอคอยตามค่าดีเลย์ซีรีย์: ${delayMs}ms`, "info");
          await waitState(delayMs);
        }
      }
    }

    setIsHarvesting(false);
    
    if (shouldStopRef.current) {
      addLog(`🛑 บังคับหยุดการทำงานโดยผู้ใช้แล้ว ข้อมูลที่ดึงได้สำเร็จยังคงถูกรักษาไว้`, "warn");
    } else {
      addLog(`🎉 เสร็จสิ้นภารกิจ! รวบรวมสำเร็จทั้งสิ้น [ ${totalSeriesFound} ] เรื่อง จากหน้า ${startPage}-${endPage}`, "success");
    }
  };

  // 123HD / 123HDTV AJAX Player Request Helper (Replicating Python Sess.post /api/get.php)
  const requestPlayerStream123 = async (params: {
    targetOrigin: string;
    referer: string;
    action: string;
    nonce: string;
    episode: string;
    server: string;
    postid: string;
  }): Promise<string | null> => {
    try {
      const apiGetUrl = `${params.targetOrigin.replace(/\/+$/, "")}/api/get.php`;
      const postProxyUrl = `/api/123hd?url=${encodeURIComponent(apiGetUrl)}&referer=${encodeURIComponent(params.referer)}`;

      const postRes = await fetch(postProxyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: params.action || "halim_ajax_player",
          nonce: params.nonce,
          episode: params.episode,
          server: params.server,
          postid: params.postid,
        }),
      });

      if (!postRes.ok) return null;
      const postHtml = await postRes.text();
      const doc = new DOMParser().parseFromString(postHtml, "text/html");
      const iframe = doc.querySelector("iframe");
      if (!iframe) return null;

      const elinkRaw = iframe.getAttribute("src") || "";
      if (!elinkRaw || elinkRaw.includes("fileprocess.html")) {
        return null;
      }

      let parsedIframeUrl: URL;
      try {
        parsedIframeUrl = new URL(elinkRaw, params.targetOrigin);
      } catch (e) {
        return null;
      }

      const cid = parsedIframeUrl.searchParams.get("id");
      if (!cid) return null;

      const purl = `${parsedIframeUrl.protocol}//${parsedIframeUrl.host}/`;
      const backup = parsedIframeUrl.searchParams.get("backup") || "0";
      const ptype = parsedIframeUrl.searchParams.get("ptype") || "0";

      let elink = `${purl}newplaylist/${cid}/${cid}.m3u8`;

      if (elinkRaw.includes("main.24playerhd.com")) {
        if (backup === "1") {
          elink = `${purl}newplaylist_g/${cid}/${cid}.m3u8`;
        } else {
          elink = `${purl}newplaylist/${cid}/${cid}.m3u8`;
        }
      } else if (elinkRaw.includes("main.abcplays.com")) {
        if (backup === "1") {
          elink = `${purl}newplaylist_g/${cid}/${cid}.m3u8`;
        } else {
          elink = `${purl}newplaylist/${cid}/${cid}.m3u8`;
        }
      } else if (elinkRaw.includes("hot.24playerhd.com")) {
        if (ptype === "2") {
          elink = `${purl}newplaylist/${cid}/${cid}.m3u8`;
        } else {
          elink = `${purl}autoplaylist/${cid}/${cid}.m3u8`;
        }
      } else {
        elink = `${purl}newplaylist/${cid}/${cid}.m3u8`;
      }

      // Check Resolution sub-streams in Master Playlist (equivalent to Python regex)
      try {
        const plRes = await fetch(`/api/123hd?url=${encodeURIComponent(elink)}&referer=${encodeURIComponent(params.referer)}`);
        if (plRes.ok) {
          const plText = await plRes.text();
          const regexPattern = /RESOLUTION=([^\n]+)\n([^\n\r]+)/g;
          let match;
          let lastSubLine = "";
          while ((match = regexPattern.exec(plText)) !== null) {
            if (match[2]) {
              lastSubLine = match[2].trim();
            }
          }
          if (lastSubLine) {
            const cleanSub = lastSubLine.replace(/^\/+/, "");
            if (cleanSub.startsWith("http")) {
              elink = cleanSub;
            } else {
              elink = `${purl}${cleanSub}`;
            }
          }
        }
      } catch (e) {
        // Fallback to original elink
      }

      return elink;
    } catch (e) {
      return null;
    }
  };

  // Helper to extract streams from a single 123HD page (Movie or Episode)
  const extractStreamsFrom123Doc = async (
    doc: Document,
    html: string,
    pageUrl: string,
    hostOrigin: string,
    rootReferer: string,
    defaultName: string
  ): Promise<{ title: string; url: string; info: string; referer: string }[]> => {
    const streams: { title: string; url: string; info: string; referer: string }[] = [];

    // Extract Nonce
    let pnonce = "";
    const nonceMatch =
      html.match(/ajax_player[\s\S]*?"nonce"\s*:\s*"([a-f0-9]+)"/) ||
      html.match(/"nonce"\s*:\s*"([a-f0-9]+)"/) ||
      html.match(/halim-ajax-player[\s\S]*?"nonce"\s*:\s*"([a-f0-9]+)"/) ||
      html.match(/halim_ajax_player.*?nonce["']?:\s*["']([a-f0-9]+)["']/i);

    if (nonceMatch) {
      pnonce = nonceMatch[1];
    } else {
      pnonce = "f597124a37";
    }

    // 1. Check multi-server/audio headers: th.lmselect
    const csub = Array.from(doc.querySelectorAll("th.lmselect, th[class*='lmselect']"));

    if (csub.length > 0) {
      for (let k = 0; k < csub.length; k++) {
        if (shouldStopRef.current) break;
        const lsub = csub[k];
        const tsub = lsub.textContent?.trim() || `Server ${k + 1}`;
        const span = lsub.querySelector("span") || lsub;
        const dataEpisode = span.getAttribute("data-episode") || "";
        const dataPostId = span.getAttribute("data-post-id") || "";
        const dataServer = span.getAttribute("data-server") || "";

        if (!dataPostId || !dataEpisode) continue;

        const streamUrl = await requestPlayerStream123({
          targetOrigin: hostOrigin,
          referer: pageUrl,
          action: "halim_ajax_player",
          nonce: pnonce,
          episode: dataEpisode,
          server: dataServer,
          postid: dataPostId,
        });

        if (streamUrl) {
          streams.push({
            title: defaultName,
            url: streamUrl,
            info: tsub,
            referer: rootReferer,
          });
        }
      }
    } else {
      // 2. Single button: .halim-btn
      const btn = doc.querySelector(".halim-btn, span.halim-btn, a.halim-btn, button.halim-btn");
      if (btn) {
        const dataEpisode = btn.getAttribute("data-episode") || "";
        const dataPostId = btn.getAttribute("data-post-id") || "";
        const dataServer = btn.getAttribute("data-server") || "";
        const tsub = btn.textContent?.trim() || "HD";

        if (dataPostId && dataEpisode) {
          const streamUrl = await requestPlayerStream123({
            targetOrigin: hostOrigin,
            referer: pageUrl,
            action: "halim_ajax_player",
            nonce: pnonce,
            episode: dataEpisode,
            server: dataServer,
            postid: dataPostId,
          });

          if (streamUrl) {
            streams.push({
              title: defaultName,
              url: streamUrl,
              info: tsub || "HD",
              referer: rootReferer,
            });
          }
        }
      }
    }

    return streams;
  };

  // 123HDTV Fetcher for manual single_post mode
  const getM3U8From123HD = async (postId: number, episode: number, nonce: string): Promise<string | null> => {
    return await requestPlayerStream123({
      targetOrigin: "https://www.123-hdx.com",
      referer: "https://www.123-hdx.com/",
      action: "halim_ajax_player",
      nonce: nonce || "f597124a37",
      episode: String(episode),
      server: "1",
      postid: String(postId),
    });
  };

  // 123HDTV Harvester Engine (Fully upgraded matching Python script)
  const startHarvesting123HD = async () => {
    if (isHarvesting) return;
    shouldStopRef.current = false;
    setIsHarvesting(true);
    setIsPaused(false);

    if (clearPrevious) {
      setSeriesList123([]);
      setLogs([]);
    }

    // Manual Single Post Mode
    if (scrapperMode123 === "single_post") {
      addLog(`🚀 เริ่มการขุดข้อมูล 123HDTV (โหมดแมนนวล)... (ID: ${postId123}, ตอนทั้งหมด: ${totalEpisodes123})`, "success");

      const episodes: Episode[] = [];
      setCurrentProgress({
        page: 1,
        seriesIndex: 0,
        totalSeriesInPage: totalEpisodes123,
        currentSeriesName: title123,
      });

      for (let ep = 1; ep <= totalEpisodes123; ep++) {
        if (shouldStopRef.current) break;

        setCurrentProgress((prev) => ({
          ...prev,
          seriesIndex: ep,
        }));

        addLog(`⏳ กำลังสืบค้นและถอดรหัส ตอนที่ ${ep} ...`, "info");
        const m3u8 = await getM3U8From123HD(postId123, ep, nonce123);

        if (m3u8) {
          episodes.push({
            title: `ตอนที่ ${ep}`,
            url: m3u8,
            tvgLogo: poster123,
            groupTitle: title123,
          });
          addLog(`✅ ถอดรหัสสำเร็จ ตอนที่ ${ep}: ${m3u8}`, "success");
        } else {
          addLog(`⚠️ ถอดรหัสตอนที่ ${ep} ล้มเหลวหรือไม่มีแหล่งที่เล่น`, "warn");
        }

        if (ep < totalEpisodes123) {
          await waitState(delayMs);
        }
      }

      if (episodes.length > 0) {
        const parsedSeries: SeriesData = {
          id: slug123 || `123-${postId123}`,
          title: title123,
          poster: poster123,
          synopsis: synopsis123,
          pageNum: 1,
          episodes,
        };
        setSeriesList123([parsedSeries]);
      }

      setIsHarvesting(false);
      if (shouldStopRef.current) {
        addLog(`🛑 บังคับยกเลิกการดึงข้อมูล 123HDTV เรียบร้อยแล้ว`, "warn");
      } else {
        addLog(`🎉 เสร็จสิ้นภารกิจดึงข้อมูล 123HDTV! ได้รับมาพร้อมสตรีมมิ่งทั้งสิ้น [ ${episodes.length} ] ตอน`, "success");
      }
      return;
    }

    // Auto Category Scraper (Python Logic Replicated in full stack proxying)
    const web_movie = categoryUrl123.trim();
    addLog(`🚀 เริ่มต้นดึงข้อมูลระบบอัตโนมัติ 123HD/123HDTV: ${web_movie}`, "success");

    try {
      // Thai Date formatted like Python timeday
      const thaiMonths = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
      const now = new Date();
      const timeday = `วันที่ ${now.getDate()} ${thaiMonths[now.getMonth() + 1]} ${now.getFullYear() + 543}`;

      // URL decomposition
      let referer = "https://www.123-hdx.com/";
      let hostOrigin = "https://www.123-hdx.com";
      let fname = "หนังใหม่-2026";
      let wname = "123-hdx";

      try {
        const parsed = new URL(web_movie);
        hostOrigin = `${parsed.protocol}//${parsed.host}`;
        referer = `${hostOrigin}/`;
        const pathSegs = decodeURIComponent(parsed.pathname).replace(/\/+$/, "").split("/").filter(Boolean);
        if (pathSegs.length > 0) {
          fname = pathSegs[pathSegs.length - 1];
        }
        const hostParts = parsed.hostname.replace(/^\.+|\.+$/g, "").split(".");
        if (hostParts.length >= 2) {
          wname = hostParts[hostParts.length - 2];
        }
      } catch (e) {}

      const f_m3u_file = `${wname}_${fname}.m3u`;
      const f_w3u_file = `${wname}_${fname}.w3u`;
      setGeneratedM3U123Name(f_m3u_file);
      setGeneratedW3U123Name(f_w3u_file);

      // Initialize Python data structures
      const jseries: any = {
        name: "",
        author: "By playid " + timeday,
        info: "",
        image: "https://www.123-hdd.com/wp-content/uploads/2019/10/testa7.png",
        groups: [],
      };

      const jmovie: any = {
        name: "",
        author: "By playid " + timeday,
        info: "",
        image: "https://www.123-hdd.com/wp-content/uploads/2019/10/testa7.png",
        stations: [],
      };

      const m3uLinesSeries: string[] = ["#EXTM3U"];
      const m3uLinesMovie: string[] = ["#EXTM3U"];

      // 1. Fetch initial category page to determine pmax and title
      addLog(`🔍 กำลังเชื่อมต่อไปยังหน้าหมวดหมู่แรก: ${web_movie}`, "info");
      const resFirst = await fetch(`/api/123hd?url=${encodeURIComponent(web_movie)}&referer=${encodeURIComponent(referer)}`);
      if (!resFirst.ok) {
        throw new Error(`ไม่สามารถเชื่อมต่อหน้าหมวดหมู่แรกได้ (Status: ${resFirst.status})`);
      }
      const firstHtml = await resFirst.text();
      const docFirst = new DOMParser().parseFromString(firstHtml, "text/html");

      // Extract section title
      const sectionTitle =
        docFirst.querySelector("h3.section-title")?.textContent?.trim() ||
        docFirst.querySelector("h1")?.textContent?.trim() ||
        fname;
      jseries.name = sectionTitle;
      jmovie.name = sectionTitle;
      addLog(`🏷️ ชื่อหมวดหมู่: "${sectionTitle}"`, "success");

      // Calculate pmax from pagination
      const pageNav = docFirst.querySelector("ul.page-numbers");
      let pmax = 1;
      if (pageNav) {
        const links = Array.from(pageNav.querySelectorAll("a"));
        if (links.length > 1) {
          const targetLink = links[links.length - 2]?.getAttribute("href") || "";
          if (targetLink) {
            const segs = decodeURIComponent(targetLink).replace(/\/+$/, "").split("/").filter(Boolean);
            const lastSeg = segs[segs.length - 1];
            const parsedNum = parseInt(lastSeg);
            if (!isNaN(parsedNum) && parsedNum > 0) {
              pmax = parsedNum;
            }
          }
          if (pmax === 1) {
            const pageTexts = links.map((lnk) => lnk.textContent?.trim() || "");
            const numbers = pageTexts.map((t) => parseInt(t.replace(/,/g, ""))).filter((n) => !isNaN(n));
            if (numbers.length > 0) {
              pmax = Math.max(...numbers);
            }
          }
        }
      }

      addLog(`📋 ตรวจพบจำนวนหน้าทั้งหมดของหมวดหมู่นี้: ${pmax} หน้า`, "info");

      const startPageNum = Math.max(1, startPage123);
      const endPageNum = Math.min(pmax, endPage123 || pmax);
      addLog(`🎯 ขอบเขตการทำงาน: เริ่มหน้าที่ ${startPageNum} ถึงหน้าที่ ${endPageNum}`, "info");

      const cleanBaseUrl = web_movie.replace(/\/+$/, "");
      let pbak = web_movie;
      let totalProcessed = 0;
      const allFetchedSeries: SeriesData[] = [];

      for (let num = startPageNum; num <= endPageNum; num++) {
        if (shouldStopRef.current) break;

        let plink = "";
        let pageReferer = referer;
        if (num === 1) {
          plink = pbak = web_movie;
          pageReferer = referer;
        } else {
          plink = `${cleanBaseUrl}/page/${num}`;
          pageReferer = pbak;
          pbak = plink;
        }

        addLog(`\n📄 [Pages ${num}/${endPageNum}] ${plink}`, "info");

        const pageRes = await fetch(`/api/123hd?url=${encodeURIComponent(plink)}&referer=${encodeURIComponent(pageReferer)}`);
        if (!pageRes.ok) {
          addLog(`❌ ไม่สามารถดึงหน้า ${num} ได้ ข้ามการทำงาน...`, "error");
          continue;
        }

        const pageHtml = await pageRes.text();
        const pageDoc = new DOMParser().parseFromString(pageHtml, "text/html");

        const div = pageDoc.querySelector("div.halim_box") || pageDoc;
        const halimItems = Array.from(div.querySelectorAll("div.halim-item"));

        if (halimItems.length === 0) {
          addLog(`⚠️ ไม่พบรายการภาพยนตร์ในหน้า ${num}`, "warn");
          continue;
        }

        const smax = halimItems.length;
        addLog(`📦 ค้นพบ [ ${smax} ] เรื่องในหน้านี้ กำลังถอดรหัส...`, "success");

        for (let i = 0; i < smax; i++) {
          if (shouldStopRef.current) break;

          const link = halimItems[i];
          const anchor = link.querySelector("a");
          if (!anchor) continue;

          const purlRaw = anchor.getAttribute("href") || "";
          const purl = purlRaw.startsWith("http") ? purlRaw : `${hostOrigin}${purlRaw.startsWith("/") ? "" : "/"}${purlRaw}`;
          const pname = anchor.getAttribute("title") || anchor.textContent?.trim() || "ไม่มีชื่อเรื่อง";

          let pinfo = "";
          try {
            const soundsub = link.querySelector("span.soundsub")?.textContent?.trim() || "";
            const status = link.querySelector("span.status")?.textContent?.trim() || "";
            pinfo = `${soundsub}(${status})`.trim();
          } catch (e) {}

          const img = link.querySelector("img");
          let ppic = img?.getAttribute("data-src") || img?.getAttribute("src") || "";
          if (ppic && !ppic.startsWith("http")) {
            ppic = `${hostOrigin.replace(/\/+$/, "")}${ppic.startsWith("/") ? "" : "/"}${ppic}`;
          }

          addLog(`🎬 [Pages : ${num}/No. : ${i + 1}/${smax}] ${pname}`, "info");

          setCurrentProgress({
            page: num,
            seriesIndex: i + 1,
            totalSeriesInPage: smax,
            currentSeriesName: pname,
          });

          totalProcessed++;

          try {
            const detailRes = await fetch(`/api/123hd?url=${encodeURIComponent(purl)}&referer=${encodeURIComponent(pbak)}`);
            if (!detailRes.ok) {
              addLog(`   ❌ ข้ามเรื่อง "${pname}": ไม่สามารถเปิดหน้ารายละเอียดได้`, "warn");
              continue;
            }

            const detailHtml = await detailRes.text();
            const detailDoc = new DOMParser().parseFromString(detailHtml, "text/html");

            // ------- แยกประเภท (Detect Series vs Movie)
            let pagetype = 0;
            const tableSequel = detailDoc.querySelector("table#Sequel");
            const selectSequel = detailDoc.querySelector("select[name='Sequel_select']");
            let episodeItems: { epname: string; epurl: string }[] = [];

            if (tableSequel) {
              const trs = tableSequel.querySelectorAll("tr");
              if (trs.length > 1) {
                const ckfirst = trs[1];
                const styleAttr = ckfirst.getAttribute("style") || "";
                if (styleAttr.includes("background-color") || trs.length > 1) {
                  pagetype = 1;
                  const tbody = tableSequel.querySelector("tbody") || tableSequel;
                  const aTags = Array.from(tbody.querySelectorAll("a"));
                  episodeItems = aTags.map((a, aIdx) => ({
                    epname: a.textContent?.trim() || `ตอนที่ ${aIdx + 1}`,
                    epurl: a.getAttribute("href") || purl,
                  }));
                }
              }
            } else if (selectSequel) {
              pagetype = 1;
              const options = Array.from(selectSequel.querySelectorAll("option"));
              episodeItems = options.map((opt, oIdx) => ({
                epname: opt.textContent?.trim() || `ตอนที่ ${oIdx + 1}`,
                epurl: opt.getAttribute("value") || purl,
              }));
            } else {
              pagetype = 0;
            }

            // If Pagetype == 1 (Series)
            if (pagetype === 1 && episodeItems.length > 0) {
              const epmax = episodeItems.length;
              const currentSeriesGroup: any = {
                name: pname,
                image: ppic,
                info: pinfo,
                stations: [],
              };
              const seriesEpisodesForApp: Episode[] = [];

              for (let j = 0; j < epmax; j++) {
                if (shouldStopRef.current) break;
                const { epname, epurl: rawEpurl } = episodeItems[j];
                const eppurl = rawEpurl.startsWith("http") ? rawEpurl : `${hostOrigin}${rawEpurl.startsWith("/") ? "" : "/"}${rawEpurl}`;

                addLog(`     [EP name : ${j + 1}/${epmax}] ${epname}`, "info");

                try {
                  const epPageRes = await fetch(`/api/123hd?url=${encodeURIComponent(eppurl)}&referer=${encodeURIComponent(purl)}`);
                  if (!epPageRes.ok) continue;
                  const epPageHtml = await epPageRes.text();
                  const epDoc = new DOMParser().parseFromString(epPageHtml, "text/html");

                  const streams = await extractStreamsFrom123Doc(epDoc, epPageHtml, eppurl, hostOrigin, referer, epname);

                  for (const st of streams) {
                    addLog(`         Playlist : ${st.url}`, "success");
                    currentSeriesGroup.stations.push({
                      name: epname,
                      info: st.info,
                      image: ppic,
                      url: st.url,
                      referer: "",
                    });

                    m3uLinesSeries.push(`#EXTINF:-1 tvg-logo="${ppic}" group-title="${pname}" ,${epname}${st.info ? ` [${st.info}]` : ""}`);
                    m3uLinesSeries.push(`#EXTVLCOPT:${referer}`);
                    m3uLinesSeries.push(st.url);

                    seriesEpisodesForApp.push({
                      title: `${epname}${st.info ? ` [${st.info}]` : ""}`,
                      url: st.url,
                      tvgLogo: ppic,
                      groupTitle: pname,
                    });
                  }
                } catch (epErr) {
                  // Skip
                }

                if (delayMs > 0) await waitState(Math.min(delayMs, 500));
              }

              if (currentSeriesGroup.stations.length > 0) {
                jseries.groups.push(currentSeriesGroup);
                const sObj: SeriesData = {
                  id: purl.split("/").filter(Boolean).pop() || `123-${num}-${i}`,
                  title: pname,
                  poster: ppic,
                  synopsis: `คุณภาพ: ${pinfo} | รวม ${seriesEpisodesForApp.length} ตอน`,
                  pageNum: num,
                  episodes: seriesEpisodesForApp,
                };
                allFetchedSeries.push(sObj);
                setSeriesList123((prev) => [...prev, sObj]);
              }
            } else {
              // Pagetype == 0 (Movie)
              const currentMovieGroup: any = {
                name: pname,
                image: ppic,
                info: pinfo,
                stations: [],
              };
              const movieEpisodesForApp: Episode[] = [];

              const streams = await extractStreamsFrom123Doc(detailDoc, detailHtml, purl, hostOrigin, referer, pname);

              for (const st of streams) {
                addLog(`         Playlist : ${st.url}`, "success");
                currentMovieGroup.stations.push({
                  name: pname,
                  info: st.info,
                  image: ppic,
                  url: st.url,
                  referer: "",
                });

                m3uLinesMovie.push(`#EXTINF:-1 tvg-logo="${ppic}" group-title="" ,${pname}${st.info ? ` [${st.info}]` : ""}`);
                m3uLinesMovie.push(`#EXTVLCOPT:${referer}`);
                m3uLinesMovie.push(st.url);

                movieEpisodesForApp.push({
                  title: `${pname}${st.info ? ` [${st.info}]` : ""}`,
                  url: st.url,
                  tvgLogo: ppic,
                  groupTitle: "ภาพยนตร์",
                });
              }

              if (currentMovieGroup.stations.length > 0) {
                jmovie.stations.push(...currentMovieGroup.stations);
                jseries.groups.push(currentMovieGroup);

                const mObj: SeriesData = {
                  id: purl.split("/").filter(Boolean).pop() || `123-${num}-${i}`,
                  title: pname,
                  poster: ppic,
                  synopsis: `คุณภาพ: ${pinfo} | แหล่งข้อมูล: 123-HD`,
                  pageNum: num,
                  episodes: movieEpisodesForApp,
                };
                allFetchedSeries.push(mObj);
                setSeriesList123((prev) => [...prev, mObj]);
              }
            }
          } catch (movieErr: any) {
            addLog(`   ❌ เกิดข้อผิดพลาดบนเรื่อง "${pname}": ${movieErr.message || movieErr}`, "error");
          }

          if (delayMs > 0) await waitState(delayMs);
        }
      }

      // Generate Final M3U & W3U payloads
      const fullM3USeries = m3uLinesSeries.join("\n");
      const fullM3UMovie = m3uLinesMovie.join("\n");
      const fullM3UCombined = [...m3uLinesSeries, ...m3uLinesMovie.slice(1)].join("\n");

      const finalM3U = separateMoviesAndSeries123
        ? (jseries.groups.some((g: any) => g.stations.length > 1) ? fullM3USeries : fullM3UMovie)
        : fullM3UCombined;

      const finalW3U = JSON.stringify(jseries, null, 2);

      setGeneratedM3U123(finalM3U);
      setGeneratedW3U123(finalW3U);

      setIsHarvesting(false);
      addLog(`🎉 THE END! เสร็จสิ้นการดึงข้อมูล 123HD รวม [ ${allFetchedSeries.length} ] เรื่อง (${totalProcessed} รายการ)`, "success");
      addLog(`📄 ไฟล์ M3U (${f_m3u_file}) และ W3U (${f_w3u_file}) พร้อมให้ดาวน์โหลดหรือคัดลอกได้ทันที`, "success");
    } catch (err: any) {
      setIsHarvesting(false);
      addLog(`❌ เกิดความขัดข้องระบบ 123HD: ${err.message || err}`, "error");
    }
  };

  // DooNang Graphql Base Query Post Call
  const callDoonangGraphQL = async (query: string, variables: any) => {
    try {
      const res = await fetch(`/api/doonang`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables })
      });
      if (!res.ok) {
        addLog(`[DooNang API] เกิดข้อผิดพลาดส่งรหัสสถานะ: ${res.status}`, "error");
        return null;
      }
      return await res.json();
    } catch (e: any) {
      addLog(`[DooNang API] การเชื่อมต่อผ่าน API เครือข่ายล้มเหลว: ${e.message || e}`, "error");
      return null;
    }
  };

  // DooNang Fetch Movie by Movie ID (ดึงหนัง)
  const fetchMovieByIdDoonang = async (movieIdStr: string) => {
    const movieId = parseInt(movieIdStr, 10);
    if (isNaN(movieId) || movieId <= 0) {
      addLog("❌ กรุณาใส่ Movie ID ที่ถูกต้อง (เช่น 1234)", "error");
      return;
    }

    shouldStopRef.current = false;
    setIsHarvesting(true);
    setIsPaused(false);
    setDoonangResultM3U("");
    setDoonangResultJSON("");

    addLog(`🔎 กำลังสืบค้นข้อมูล Doo-Nang Movie ID: ${movieId}...`, "info");

    const query = `
      query getMovie($id: Int!) {
        movie(id: $id) {
          id titleTh titleEn descriptionTh synopsisTh releaseDate posterUrl imdbRating slug nation
          genres { name slug }
          video { transcodeUuid cdnHostname }
        }
      }
    `;

    try {
      const result = await callDoonangGraphQL(query, { id: movieId });
      const movie = result?.data?.movie;
      if (!movie) {
        addLog(`❌ ไม่พบข้อมูลภาพยนตร์ Movie ID: ${movieId}`, "error");
        setIsHarvesting(false);
        return;
      }

      addLog(`✅ พบภาพยนตร์: '${movie.titleTh || movie.titleEn}'! กำลังวิเคราะห์ Video Stream, Subtitle และ Audio Tracks...`, "success");

      const nationMap: Record<string, string> = {
        TH: "ภาพยนตร์ ไทย",
        KR: "ภาพยนตร์ เกาหลี",
        JP: "ภาพยนตร์ ญี่ปุ่น",
        IN: "ภาพยนตร์ อินเดีย",
        US: "ภาพยนตร์ สหรัฐอเมริกา",
        CA: "ภาพยนตร์ แคนาดา",
        CN: "ภาพยนตร์ จีน",
        FR: "ภาพยนตร์ ฝรั่งเศส",
        GB: "ภาพยนตร์ อังกฤษ",
        MY: "ภาพยนตร์ มาเลเซีย",
        ES: "ภาพยนตร์ สเปน",
        PH: "ภาพยนตร์ ฟิลิปปินส์",
        IE: "ภาพยนตร์ ไอร์แลนด์",
        ID: "ภาพยนตร์ อินโดนีเซีย"
      };

      const genres = movie.genres?.map((g: any) => g.name) || [];
      const imdbRating = movie.imdbRating || "0.0";
      const plot = movie.descriptionTh?.trim() || movie.synopsisTh?.trim() || "-";
      const year = movie.releaseDate?.substring(0, 4) || "0000";
      const category = nationMap[movie.nation] || "ภาพยนตร์ ทั่วไป";

      const transcodeUuid = movie.video?.transcodeUuid;
      const cdnHostname = movie.video?.cdnHostname;
      const subtitle: any[] = [];
      let audioTracks: any[] = [];
      let videoUrl = "";

      if (transcodeUuid) {
        videoUrl = `https://api.doo-nang.com/video/${transcodeUuid}/playlist.m3u8`;

        if (cdnHostname) {
          const base = `https://${cdnHostname}/${transcodeUuid}`;
          const subtitleVariants = [
            { lang: "th", codec: "VTT", src: `${base}/sub_tha.vtt` },
            { lang: "th", codec: "BDN", src: `${base}/sub_tha/index.xml` }
          ];

          for (const sub of subtitleVariants) {
            try {
              const subCheck = await fetch(`/api/doonang?url=${encodeURIComponent(sub.src)}`, { method: "HEAD" });
              if (subCheck.ok) subtitle.push(sub);
            } catch {}
          }
        }

        try {
          const res = await fetch(`/api/doonang?url=${encodeURIComponent(videoUrl)}`);
          if (res.ok) {
            const m3u8Text = await res.text();
            const regex = /#EXT-X-MEDIA:TYPE=AUDIO.*?LANGUAGE="([^"]+)".*?URI="([^"]+)"/g;
            let match;
            while ((match = regex.exec(m3u8Text)) !== null) {
              audioTracks.push({ language: match[1], uri: match[2] });
            }
          }
        } catch {}
      }

      const movieDisplayName = `${movie.titleEn || movie.titleTh || "Movie"} - ${movie.titleTh || movie.titleEn || ""}`.trim();

      const movieData: any = {
        id: movie.id,
        name: movieDisplayName,
        category,
        info: {
          poster: movie.posterUrl || "https://picsum.photos/seed/doonang/300/450",
          genre: genres,
          plot,
          rating: imdbRating,
          year
        },
        video: videoUrl,
        subtitle,
        audioTracks
      };

      // Generate M3U
      let m3u = "#EXTM3U\n";
      const logo = movieData.info.poster;
      const mainTitle = movieData.name;
      if (videoUrl) {
        m3u += `#EXTINF:-1 type="movie" group-title="${category}" tvg-logo="${logo}" tvg-name="${mainTitle}", ${mainTitle}\n`;
        m3u += `${videoUrl}\n`;
      }

      setDoonangResultM3U(m3u);
      setDoonangResultJSON(JSON.stringify(movieData, null, 2));

      if (videoUrl) {
        const finishedCard: SeriesData = {
          id: `movie-${movie.id}`,
          title: movieDisplayName,
          poster: logo,
          pageNum: 1,
          episodes: [
            {
              title: `${movieDisplayName} [Full Movie]`,
              url: videoUrl
            }
          ],
          synopsis: `หมวดหมู่: ${category} | ปี: ${year} | คะแนน IMDb: ${imdbRating} | เรื่องย่อ: ${plot.substring(0, 150)}...`
        };

        setSeriesListDoonang((prev) => [finishedCard, ...prev.filter(it => it.id !== finishedCard.id)]);
        addLog(`🎉 ดึงข้อมูลภาพยนตร์สำเร็จ! '${movieDisplayName}' ลิงก์: ${videoUrl.substring(0, 50)}...`, "success");
      } else {
        addLog(`⚠️ ไม่พบ URL วิดีโอสำหรับ Movie ID: ${movieId}`, "warn");
      }

    } catch (err: any) {
      addLog(`❌ เกิดข้อผิดพลาดในการดึงข้อมูล Movie ID ${movieId}: ${err.message || err}`, "error");
    } finally {
      setIsHarvesting(false);
    }
  };

  // DooNang Fetch Movies by Tag / Category / Country
  const fetchMoviesByTagDoonang = async (inputValue: string) => {
    let targetValue = inputValue.trim();
    if (!targetValue) {
      addLog("❌ กรุณากรอก Tag, ประเทศ หรือวาง URL", "error");
      return;
    }

    // ถ้าวาง URL มา ให้ดึงพารามิเตอร์ `value` ออกมา
    if (targetValue.includes("http")) {
      try {
        const urlObj = new URL(targetValue);
        const valParam = urlObj.searchParams.get("value");
        if (valParam) targetValue = decodeURIComponent(valParam);
      } catch {}
    }

    const nationMap: Record<string, string> = {
      TH: "ภาพยนตร์ ไทย", KR: "ภาพยนตร์ เกาหลี", JP: "ภาพยนตร์ ญี่ปุ่น", CN: "ภาพยนตร์ จีน",
      HK: "ภาพยนตร์ ฮ่องกง", TW: "ภาพยนตร์ ไต้หวัน", IN: "ภาพยนตร์ อินเดีย", ID: "ภาพยนตร์ อินโดนีเซีย",
      PH: "ภาพยนตร์ ฟิลิปปินส์", MY: "ภาพยนตร์ มาเลเซีย", US: "ภาพยนตร์ สหรัฐอเมริกา", CA: "ภาพยนตร์ แคนาดา",
      GB: "ภาพยนตร์ อังกฤษ", FR: "ภาพยนตร์ ฝรั่งเศส", DE: "ภาพยนตร์ เยอรมนี", ES: "ภาพยนตร์ สเปน",
      IE: "ภาพยนตร์ ไอร์แลนด์"
    };

    const nationReverseMap: Record<string, string> = {
      // ไทย
      "ไทย": "TH", "thai": "TH", "thailand": "TH", "th": "TH",
      // เกาหลี
      "เกาหลี": "KR", "korea": "KR", "korean": "KR", "kr": "KR",
      // ญี่ปุ่น
      "ญี่ปุ่น": "JP", "japan": "JP", "japanese": "JP", "jp": "JP",
      // จีน / ฮ่องกง / ไต้หวัน
      "จีน": "CN", "china": "CN", "cn": "CN",
      "ฮ่องกง": "HK", "hongkong": "HK", "hk": "HK",
      "ไต้หวัน": "TW", "taiwan": "TW", "tw": "TW",
      // สหรัฐอเมริกา / อังกฤษ
      "สหรัฐอเมริกา": "US", "usa": "US", "us": "US", "america": "US",
      "อังกฤษ": "GB", "uk": "GB", "gb": "GB", "england": "GB",
      // ยุโรป & เอเชียอื่นๆ
      "ฝรั่งเศส": "FR", "france": "FR", "fr": "FR",
      "เยอรมนี": "DE", "germany": "DE", "de": "DE",
      "สเปน": "ES", "spain": "ES", "es": "ES",
      "แคนาดา": "CA", "canada": "CA", "ca": "CA",
      "อินเดีย": "IN", "india": "IN", "in": "IN",
      "อินโดนีเซีย": "ID", "indonesia": "ID", "id": "ID",
      "ฟิลิปปินส์": "PH", "philippines": "PH", "ph": "PH",
      "มาเลเซีย": "MY", "malaysia": "MY", "my": "MY"
    };

    // แปลงค่าคำค้นหาเป็น Code (เช่น japan -> JP, เกาหลี -> KR)
    const lookupKey = targetValue.toLowerCase();
    const nationCode = nationReverseMap[lookupKey] || nationReverseMap[targetValue] || (targetValue.length === 2 ? targetValue.toUpperCase() : "");

    shouldStopRef.current = false;
    setIsHarvesting(true);
    setIsPaused(false);
    setDoonangResultM3U("");
    setDoonangResultJSON("");

    addLog(`🔎 กำลังสืบค้นรายการภาพยนตร์ Doo-Nang หมวดหมู่/Tag: "${targetValue}"${nationCode ? ` (ISO Country Code: ${nationCode})` : ""}...`, "info");

    const query = `
      query getMovies($skip: Int!, $take: Int!, $where: MovieWhereInput) {
        movies(skip: $skip, take: $take, where: $where, orderBy: {createdAt: desc}) {
          items {
            id
            titleTh
            titleEn
            synopsisTh
            descriptionTh
            releaseDate
            posterUrl
            backdropUrl
            rating
            imdbRating
            nation
            slug
            viewed
            video {
              transcodeUuid
              cdnHostname
              duration
            }
          }
          page
          pages
          perPage
          total
        }
      }
    `;

    const variables = {
      skip: 0,
      take: 300,
      where: nationCode ? { nation: { equals: nationCode } } : {}
    };

    try {
      const result = await callDoonangGraphQL(query, variables);
      const items = result?.data?.movies?.items || [];

      if (items.length === 0) {
        addLog(`❌ ไม่พบรายการภาพยนตร์ในหมวดหมู่/Tag: "${targetValue}"`, "error");
        setIsHarvesting(false);
        return;
      }

      addLog(`✅ พบรายการภาพยนตร์ทั้งหมด ${items.length} เรื่อง ในหมวดหมู่ "${targetValue}"! กำลังประมวลผลวิดีโอเพลย์ลิสต์...`, "success");

      const mappedMovies = items.map((m: any) => {
        const uuid = m.video?.transcodeUuid;
        const category = nationMap[m.nation] || `ภาพยนตร์ ${m.nation || "ทั่วไป"}`;
        const name = m.titleTh || m.titleEn || `Movie ${m.id}`;
        const year = m.releaseDate?.substring(0, 4) || "0000";
        const playlist = uuid ? `https://api.doo-nang.com/video/${uuid}/playlist.m3u8` : "";
        return {
          id: m.id,
          name,
          category,
          poster: m.posterUrl || "https://picsum.photos/seed/doonang/300/450",
          year,
          rating: m.imdbRating || m.rating || "0.0",
          plot: m.synopsisTh || m.descriptionTh || "-",
          playlist
        };
      });

      // Generate M3U
      let m3u = "#EXTM3U\n";
      const seriesCards: SeriesData[] = [];

      mappedMovies.forEach((item: any) => {
        if (item.playlist) {
          m3u += `#EXTINF:-1 type="movie" group-title="${item.category}" tvg-logo="${item.poster}", ${item.name} (${item.year})\n`;
          m3u += `${item.playlist}\n`;

          seriesCards.push({
            id: `movie-${item.id}`,
            title: `${item.name} (${item.year})`,
            poster: item.poster,
            pageNum: 1,
            episodes: [
              {
                title: `${item.name} [Full Movie]`,
                url: item.playlist
              }
            ],
            synopsis: `หมวดหมู่: ${item.category} | ปี: ${item.year} | Rating: ${item.rating} | เรื่องย่อ: ${item.plot.substring(0, 150)}...`
          });
        }
      });

      setDoonangResultM3U(m3u);
      setDoonangResultJSON(JSON.stringify(mappedMovies, null, 2));

      if (seriesCards.length > 0) {
        setSeriesListDoonang(seriesCards);
        addLog(`🎉 นำเข้าภาพยนตร์สำเร็จ ${seriesCards.length} เรื่องลงในคลังและสร้าง M3U เรียบร้อยแล้ว!`, "success");
      } else {
        addLog(`⚠️ ไม่พบ URL วิดีโอในรายการภาพยนตร์ที่ค้นพบ`, "warn");
      }

    } catch (err: any) {
      addLog(`❌ เกิดข้อผิดพลาดในการดึงข้อมูล Tag "${targetValue}": ${err.message || err}`, "error");
    } finally {
      setIsHarvesting(false);
    }
  };

  // DooNang Fetch Series by Show ID
  const fetchSeriesByIdDoonang = async (showIdStr: string) => {
    const showId = parseInt(showIdStr, 10);
    if (isNaN(showId) || showId <= 0) {
      addLog("❌ กรุณาใส่ Show ID ที่ถูกต้อง (เช่น 1234)", "error");
      return;
    }

    shouldStopRef.current = false;
    setIsHarvesting(true);
    setIsPaused(false);
    setDoonangResultM3U("");
    setDoonangResultJSON("");

    addLog(`🔎 กำลังสืบค้นข้อมูล Doo-Nang Series ID: ${showId}...`, "info");

    const query = `
      query getShow($id: Int!) {
        show(id: $id) {
          id titleTh titleEn nation synopsisTh descriptionTh releaseDate posterUrl
          episodes {
            seasonNo episodeNo titleTh titleEn synopsisTh releaseDate posterUrl
            video { transcodeUuid cdnHostname subtitleMetadata }
          }
        }
      }
    `;

    try {
      const result = await callDoonangGraphQL(query, { id: showId });
      const show = result?.data?.show;
      if (!show) {
        addLog(`❌ ไม่พบข้อมูลซีรีส์ Show ID: ${showId}`, "error");
        setIsHarvesting(false);
        return;
      }

      addLog(`✅ พบซีรีส์: '${show.titleTh || show.titleEn}'! กำลังประมวลผลซีซัน, Subtitle และ Audio Tracks...`, "success");

      const nationMap: Record<string, string> = {
        TH: "ซีรีส์ ไทย",
        KR: "ซีรีส์ เกาหลี",
        JP: "ซีรีส์ ญี่ปุ่น",
        US: "ซีรีส์ สหรัฐอเมริกา"
      };

      const seriesData: any = {
        id: show.id,
        name: show.titleTh || show.titleEn,
        category: nationMap[show.nation] || "ซีรีส์",
        info: {
          poster: show.posterUrl || "https://picsum.photos/seed/doonang/300/450",
          plot: show.synopsisTh || show.descriptionTh || "-",
          year: show.releaseDate?.substring(0, 4) || "0000"
        },
        seasons: []
      };

      const seasonMap: Record<number, any> = {};
      const rawEps = show.episodes || [];

      for (let i = 0; i < rawEps.length; i++) {
        if (shouldStopRef.current) break;
        const ep = rawEps[i];
        const seasonNo = parseInt(ep.seasonNo || "1", 10);
        
        const transcodeUuid = ep.video?.transcodeUuid;
        const cdnHostname = ep.video?.cdnHostname;
        let videoUrl = "";
        let subtitle: any[] = [];
        let audioTracks: any[] = [];

        if (transcodeUuid) {
          videoUrl = `https://api.doo-nang.com/video/${transcodeUuid}/playlist.m3u8`;

          if (cdnHostname && ep.video?.subtitleMetadata) {
            const base = `https://${cdnHostname}/${transcodeUuid}`;
            for (const [lang, subs] of Object.entries<any>(ep.video.subtitleMetadata)) {
              for (const sub of subs) {
                const src = `${base}/${sub.pathName}.${sub.codec.toLowerCase()}`;
                try {
                  const subCheck = await fetch(`/api/doonang?url=${encodeURIComponent(src)}`, { method: "HEAD" });
                  if (subCheck.ok) {
                    subtitle.push({ lang, codec: sub.codec, src });
                  }
                } catch {}
              }
            }
          }

          try {
            const res = await fetch(`/api/doonang?url=${encodeURIComponent(videoUrl)}`);
            if (res.ok) {
              const m3u8Text = await res.text();
              const regex = /#EXT-X-MEDIA:TYPE=AUDIO.*?LANGUAGE="([^"]+)".*?URI="([^"]+)"/g;
              let match;
              while ((match = regex.exec(m3u8Text)) !== null) {
                audioTracks.push({ language: match[1], uri: match[2] });
              }
            }
          } catch {}
        }

        const processedEp = {
          episode: parseInt(ep.episodeNo, 10),
          title: ep.titleTh || ep.titleEn || `EP${ep.episodeNo}`,
          video: videoUrl,
          subtitle,
          audioTracks
        };

        if (!seasonMap[seasonNo]) {
          seasonMap[seasonNo] = {
            season: seasonNo,
            name: `${seriesData.name} - Season ${seasonNo}`,
            episodes: []
          };
        }
        seasonMap[seasonNo].episodes.push(processedEp);
      }

      seriesData.seasons = Object.values(seasonMap).sort((a: any, b: any) => a.season - b.season);

      // Generate M3U
      let m3u = "#EXTM3U\n";
      const logo = seriesData.info.poster;
      const mainTitle = seriesData.name;

      const cardEpisodes: Episode[] = [];

      seriesData.seasons.forEach((s: any) => {
        s.episodes.sort((a: any, b: any) => a.episode - b.episode);
        s.episodes.forEach((ep: any) => {
          if (ep.video) {
            const S = String(s.season).padStart(2, '0');
            const E = String(ep.episode).padStart(2, '0');
            m3u += `#EXTINF:-1 type="series" group-title="${mainTitle}" tvg-logo="${logo}" tvg-season="${s.season}" tvg-episode="${ep.episode}", ${mainTitle} S${S} E${E} - ${ep.title}\n`;
            m3u += `${ep.video}\n`;

            cardEpisodes.push({
              title: `S${S} E${E} - ${ep.title}`,
              url: ep.video
            });
          }
        });
      });

      setDoonangResultM3U(m3u);
      setDoonangResultJSON(JSON.stringify(seriesData, null, 2));

      if (cardEpisodes.length > 0) {
        const finishedCard: SeriesData = {
          id: String(show.id),
          title: seriesData.name,
          poster: logo,
          pageNum: 1,
          episodes: cardEpisodes,
          synopsis: `Category: ${seriesData.category} | Year: ${seriesData.info.year} | Plot: ${seriesData.info.plot}`
        };

        setSeriesListDoonang((prev) => [finishedCard, ...prev.filter(it => it.id !== finishedCard.id)]);
        addLog(`🎉 สร้าง M3U และ JSON สำเร็จสำหรับ '${seriesData.name}' (${cardEpisodes.length} ตอน)`, "success");
      }

    } catch (err: any) {
      addLog(`❌ เกิดข้อผิดพลาดในการดึงข้อมูล Show ID ${showId}: ${err.message || err}`, "error");
    } finally {
      setIsHarvesting(false);
    }
  };

  // DooNang GraphQL Movies/Series Scraper Engine
  const startHarvestingDoonang = async () => {
    if (doonangFetchMode === "movie_id") {
      await fetchMovieByIdDoonang(doonangMovieId);
      return;
    }

    if (doonangFetchMode === "tag") {
      await fetchMoviesByTagDoonang(doonangTagValue);
      return;
    }

    if (doonangFetchMode === "show_id") {
      await fetchSeriesByIdDoonang(doonangShowId);
      return;
    }

    if (isHarvesting) return;
    shouldStopRef.current = false;
    setIsHarvesting(true);
    setIsPaused(false);

    if (clearPrevious) {
      setSeriesListDoonang([]);
      setLogs([]);
    }

    addLog(`🚀 เริ่มดึงข้อมูล Netflix Series จาก doo-nang.com [Page ${pageDoonang}] ผ่านเซิร์ฟเวอร์แบบ GraphQL...`, "success");

    const limit = limitDoonang;
    const offset = (pageDoonang - 1) * limit;

    const listQuery = `
      query getShows($limit: Int, $offset: Int, $type: String, $value: String) {
        shows(limit: $limit, offset: $offset, type: $type, value: $value) {
          items { id titleTh titleEn posterUrl }
        }
      }
    `;

    addLog(`⌛ ส่งคิวรีดึงรายชื่อซีรีย์ Netflix ของเพจที่เขียน...`, "info");
    const listRes = await callDoonangGraphQL(listQuery, { limit, offset, type: "serie-tag", value: "netflix" });
    const items = listRes?.data?.shows?.items || [];

    if (items.length === 0) {
      addLog(`⚠️ ไม่พบคลังข้อมูลรายการ Netflix ในหน้านี้ หรือ API มีการปิดกั้น Origin`, "error");
      setIsHarvesting(false);
      return;
    }

    addLog(`✅ ดึงรายชื่อสำเร็จ พบทั้งหมด ${items.length} เรื่อง! ดำเนินการวิเคราะห์ตอนย่อยลิงค์ .m3u8 ทีละเรื่อง...`, "success");

    setCurrentProgress({
      page: pageDoonang,
      seriesIndex: 0,
      totalSeriesInPage: items.length,
      currentSeriesName: "กำลังจัดเตรียมคิว...",
    });

    const detailQuery = `
      query getShow($id: Int!) {
        show(id: $id) {
          id titleTh titleEn posterUrl
          episodes {
            seasonNo episodeNo titleTh
            video { transcodeUuid }
          }
        }
      }
    `;

    let activeParsed = 0;

    for (let i = 0; i < items.length; i++) {
      if (shouldStopRef.current) break;

      const item = items[i];
      const title = item.titleTh || item.titleEn || `Series #${item.id}`;
      
      setCurrentProgress((prev) => ({
        ...prev,
        seriesIndex: i + 1,
        currentSeriesName: title,
      }));

      addLog(`[${i + 1}/${items.length}] 📬 ร้องขอดีเทลซีรีย์: '${title}'`, "info");

      const detailRes = await callDoonangGraphQL(detailQuery, { id: parseInt(item.id) });
      const show = detailRes?.data?.show;

      if (show) {
        const episodes: Episode[] = [];
        const rawEps = show.episodes || [];

        rawEps.forEach((ep: any) => {
          if (ep.video && ep.video.transcodeUuid) {
            const m3u8Url = `https://api.doo-nang.com/video/${ep.video.transcodeUuid}/playlist.m3u8`;
            const s = String(ep.seasonNo || 1).padStart(2, "0");
            const e = String(ep.episodeNo).padStart(2, "0");
            episodes.push({
              title: `S${s}E${e} - ${ep.titleTh || `ตอนที่ ${ep.episodeNo}`}`,
              url: m3u8Url
            });
          }
        });

        if (episodes.length > 0) {
          const finishedCard: SeriesData = {
            id: String(show.id),
            title: show.titleTh || show.titleEn || `Series ${show.id}`,
            poster: show.posterUrl || "https://picsum.photos/seed/doonang/300/450",
            pageNum: pageDoonang,
            episodes,
            synopsis: `Title En: ${show.titleEn || "N/A"} | Tags: Netflix Series / Doo-Nang GraphQL Engine`
          };

          setSeriesListDoonang((prev) => {
            const filtered = prev.filter((it) => it.id !== finishedCard.id);
            return [...filtered, finishedCard];
          });
          activeParsed++;
          addLog(`✅ บันทึกซีรีย์สำเร็จ: '${finishedCard.title}' มี ${episodes.length} ตอน`, "success");
        } else {
          addLog(`⚠️ ข้ามเรื่อง '${title}' เนื่องจากไม่พบ transcode_uuid ในระบบเซิร์ฟเวอร์`, "warn");
        }
      }

      if (i < items.length - 1) {
        await waitState(delayMs);
      }
    }

    setIsHarvesting(false);
    if (shouldStopRef.current) {
      addLog(`🛑 สั่งระงับกระบวนการดึงข้อมูล Doo-Nang ซีรีย์ที่ดึงได้สำเร็จยังคงถูกแสดงผลบนหน้าจอ`, "warn");
    } else {
      addLog(`🎉 เสร็จสิ้นการจัดทำสารบัญ Doo-Nang! ถอนรหัสสตรีมมิ่งสำเร็จทั้งหมด [ ${activeParsed} / ${items.length} ] เรื่อง`, "success");
    }
  };

  // EzMovie Helpers & Harvester
  const fetchEzProxy = async (url: string) => {
    try {
      const proxyUrl = `/api/ezmovie?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) {
        addLog(`[EzMovie Proxy] ไม่สามารถโหลดได้: ${res.status} สำหรับ URL: ${url}`, "error");
        return null;
      }
      return await res.text();
    } catch (e: any) {
      addLog(`[EzMovie Proxy] เกิดข้อผิดพลาดเชื่อมต่อ: ${e.message || e}`, "error");
      return null;
    }
  };

  const parseEzMovieList = async (categoryPath: string, pageNum: number) => {
    let cleanPath = categoryPath.trim();
    if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
      try {
        const parsedNode = new URL(cleanPath);
        cleanPath = parsedNode.pathname;
        if (parsedNode.search) {
          const searchParams = new URLSearchParams(parsedNode.search);
          searchParams.delete("page");
          const searchStr = searchParams.toString();
          cleanPath += searchStr ? `?${searchStr}` : "";
        }
      } catch (e) {
        // Fallback
      }
    }

    if (cleanPath && !cleanPath.startsWith("/")) {
      cleanPath = "/" + cleanPath;
    }

    const separator = cleanPath.includes("?") ? "&" : "?";
    const url = `https://ezmovie.movie${cleanPath}${separator}page=${pageNum}`;
    addLog(`⏳ กำลังสืบค้นรายการจากหน้า ${pageNum}: ${url}`, "info");

    const html = await fetchEzProxy(url);
    if (!html) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const movies: { title: string; image: string; movieUrl: string }[] = [];

    const aElements = doc.querySelectorAll("a[data-url]");
    aElements.forEach((el) => {
      const title = el.querySelector("h2.-title")?.textContent?.trim() || el.textContent?.trim() || "หนังนิรนาม";

      let image = el.querySelector("img")?.getAttribute("data-src") || el.querySelector("img")?.getAttribute("src") || "";
      if (image && image.startsWith("data:")) {
        image = el.querySelector("source")?.getAttribute("srcset") || "";
      }

      const ajaxPath = el.getAttribute("data-url") || "";
      if (ajaxPath) {
        const movieUrl = "https://ezmovie.movie" + ajaxPath.replace("/_ajax/movie/", "/movie/");
        movies.push({ title, image, movieUrl });
      }
    });

    return movies;
  };

  const extractFromPlayer = async (playerUrl: string): Promise<Episode[]> => {
    const html = await fetchEzProxy(playerUrl);
    if (!html) return [];

    const matches = html.match(/https?:\/\/[^"' ]+\.m3u8[^"' ]*/g);
    if (!matches) return [];

    const episodes: Episode[] = [];
    const uniqueUrls = new Set<string>();

    matches.forEach((m) => {
      const mUri = m.trim();
      const lower = mUri.toLowerCase();
      if (lower.includes("intro") || lower.includes("ads")) return;
      if (uniqueUrls.has(mUri)) return;

      uniqueUrls.add(mUri);
      episodes.push({
        title: `M3U8 Stream - เซิร์ฟเวอร์ ${episodes.length + 1}`,
        url: mUri
      });
    });

    return episodes;
  };

  const getMoviePage = async (movieUrl: string): Promise<Episode[]> => {
    const html = await fetchEzProxy(movieUrl);
    if (!html) return [];

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const iframes = doc.querySelectorAll("iframe");

    let servers: Episode[] = [];
    
    for (let i = 0; i < iframes.length; i++) {
      const src = iframes[i].getAttribute("src");
      if (!src || src.includes("youtube") || src.includes("google.com/recaptcha")) continue;

      let absoluteSrc = src;
      if (src.startsWith("//")) {
        absoluteSrc = "https:" + src;
      } else if (src.startsWith("/")) {
        absoluteSrc = "https://ezmovie.movie" + src;
      }

      addLog(`🕵️ วิเคราะห์แฝงตัวเล่นไฟล์: ${absoluteSrc.substring(0, 80)}...`, "info");
      const innerServers = await extractFromPlayer(absoluteSrc);
      servers = servers.concat(innerServers);
    }

    return servers;
  };

  const startHarvestingEzMovie = async () => {
    if (isHarvesting) return;
    shouldStopRef.current = false;
    setIsHarvesting(true);
    setIsPaused(false);

    if (clearPrevious) {
      setSeriesListEz([]);
      setLogs([]);
    }

    addLog(`🚀 เริ่มดึงข้อมูล EzMovie... [หน้า ${ezStartPage} - ${ezEndPage}] [หมวด: ${ezCategory}]`, "success");

    let totalSaved = 0;

    for (let p = ezStartPage; p <= ezEndPage; p++) {
      if (shouldStopRef.current) break;

      addLog(`📂 เข้าถึงข้อมูลหน้า ${p}...`, "info");
      const movies = await parseEzMovieList(ezCategory, p);

      if (movies.length === 0) {
        addLog(`🛑 ไม่พบหนังว่างในหน้า ${p} → จบการทำงานในสารบัญนี้`, "warn");
        break;
      }

      addLog(`✅ พบทั้งหมด ${movies.length} เรื่อง ในหน้า ${p}! ระบบกำลังประมวลช่องสตรีมมิ่ง...`, "success");

      setCurrentProgress({
        page: p,
        seriesIndex: 0,
        totalSeriesInPage: movies.length,
        currentSeriesName: "เตรียมคิว...",
      });

      for (let i = 0; i < movies.length; i++) {
        if (shouldStopRef.current) break;

        const movie = movies[i];
        
        setCurrentProgress((prev) => ({
          ...prev,
          seriesIndex: i + 1,
          currentSeriesName: movie.title,
        }));

        addLog(`[${i + 1}/${movies.length}] 🎥 ดึงข้อมูลหนัง: '${movie.title}' ...`, "info");

        const servers = await getMoviePage(movie.movieUrl);

        if (servers && servers.length > 0) {
          const slug = movie.movieUrl.split("/").pop() || generateFallbackId("ez");
          const finishedMovie: SeriesData = {
            id: slug,
            title: movie.title,
            poster: movie.image || "https://picsum.photos/seed/ezmovie/300/450",
            pageNum: p,
            episodes: servers,
            synopsis: `หมวดหมู่: ${ezCategory} | ลิงก์ตรง: ${movie.movieUrl}`
          };

          setSeriesListEz((prev) => {
            const filtered = prev.filter((it) => it.id !== finishedMovie.id);
            return [...filtered, finishedMovie];
          });
          totalSaved++;
          addLog(`✅ ถอดรหัสสำเร็จ: '${finishedMovie.title}' (${finishedMovie.episodes.length} stream sources)`, "success");
        } else {
          addLog(`⚠️ ข้ามเรื่อง '${movie.title}' เนื่องจากไม่พบช่อง m3u8`, "warn");
        }

        if (i < movies.length - 1) {
          await waitState(delayMs);
        }
      }
    }

    setIsHarvesting(false);
    if (shouldStopRef.current) {
      addLog(`🛑 ยกเลิกภารกิจขุด EzMovie กลางทางเรียบร้อยแล้ว`, "warn");
    } else {
      addLog(`🎉 สารบัญ EzMovie เสร็จสิ้นเรียบร้อย! ค้นพบและเชื่อมได้ทั้งหมด ${totalSaved} เรื่อง`, "success");
    }
  };

  // WOW-Drama Scraper Engine
  const fetchWowProxy = async (targetUrl: string, referer?: string) => {
    try {
      const urlParam = encodeURIComponent(targetUrl);
      const refererParam = referer ? `&referer=${encodeURIComponent(referer)}` : "";
      const res = await fetch(`/api/wowdrama?url=${urlParam}${refererParam}`);
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  const fetchWowPlayerPost = async (postId: string) => {
    try {
      const res = await fetch(`/api/wowdrama`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "miru_custom_player", post_id: postId })
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  const startHarvestingWowDrama = async () => {
    if (isHarvesting) return;
    shouldStopRef.current = false;
    setIsHarvesting(true);
    setIsPaused(false);

    if (clearPrevious) {
      setSeriesListWow([]);
      setLogs([]);
    }

    addLog(`🚀 เริ่มขุดข้อมูล WOW-Drama.com... [หน้า ${startPageWow} - ${endPageWow}] [หมวดหมู่: ${categoryUrlWow}]`, "success");

    let totalSaved = 0;

    for (let page = startPageWow; page <= endPageWow; page++) {
      if (shouldStopRef.current) break;

      let pageUrl = categoryUrlWow;
      if (page > 1) {
        pageUrl = categoryUrlWow.replace(/\/$/, "") + `/page/${page}/`;
      }

      addLog(`📂 [Page ${page}/${endPageWow}] กำลังโหลดหน้า: ${pageUrl}`, "info");

      const html = await fetchWowProxy(pageUrl, "https://wow-drama.com/");
      if (!html) {
        addLog(`⚠️ ไม่สามารถดึงข้อมูลหน้า ${page} ได้`, "warn");
        continue;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const div = doc.querySelector("#main .list-movie");
      const movieCards = div ? Array.from(div.querySelectorAll(".-movie")) : [];

      if (movieCards.length === 0) {
        addLog(`--- ไม่พบรายการหนัง/ซีรีส์ ในหน้า ${page} ---`, "warn");
        continue;
      }

      addLog(`🔍 พบคลังซีรีส์ในหน้า ${page} ทั้งหมด ${movieCards.length} เรื่อง`, "info");

      for (let sIndex = 0; sIndex < movieCards.length; sIndex++) {
        if (shouldStopRef.current) break;

        const card = movieCards[sIndex];
        const h2a = card.querySelector("h2 a");
        const img = card.querySelector("img");
        const aLink = card.querySelector("a");

        const pname = h2a ? h2a.textContent?.trim() || "Unknown" : "Unknown";
        const ppic = img ? img.getAttribute("src") || "" : "";
        const purl = aLink ? aLink.getAttribute("href") || "" : "";

        const imdbEl = card.querySelector(".imdb");
        const pinfo = imdbEl ? imdbEl.textContent?.trim() || "" : "";

        const statusEl = card.querySelector(".qa-label");
        const pstatus = statusEl ? statusEl.textContent?.trim() || "" : "";

        if (skipUnfinishedWow && pstatus === "ยังไม่จบ") {
          addLog(`⏭️ ข้ามเรื่อง '${pname}' (สถานะยังไม่จบ)`, "info");
          continue;
        }

        if (!purl) continue;

        setCurrentProgress({
          page,
          seriesIndex: sIndex + 1,
          totalSeriesInPage: movieCards.length,
          currentSeriesName: pname
        });

        addLog(`🎬 [${sIndex + 1}/${movieCards.length}] ดึงข้อมูลเรื่อง: ${pname} (${pstatus || pinfo || "ซีรีส์"})`, "info");

        // Fetch series detail page
        const detailHtml = await fetchWowProxy(purl, pageUrl);
        if (!detailHtml) {
          addLog(`  ⚠️ ไม่สามารถโหลดรายละเอียดซีรีส์: ${pname}`, "warn");
          continue;
        }

        const detailDoc = parser.parseFromString(detailHtml, "text/html");
        const epBtns = Array.from(detailDoc.querySelectorAll(".mp-ep-btn"));

        if (epBtns.length === 0) {
          addLog(`  ⚠️ ไม่พบปุ่มตอนวิดีโอ (.mp-ep-btn) สำหรับ: ${pname}`, "warn");
          continue;
        }

        const episodes: Episode[] = [];

        for (let j = 0; j < epBtns.length; j++) {
          if (shouldStopRef.current) break;

          const btn = epBtns[j];
          const rawText = btn.textContent || "";
          const ename = rawText.split("|").pop()?.trim() || `ตอนที่ ${j + 1}`;
          const pid = btn.getAttribute("data-id");

          if (!pid) continue;

          // Request custom player
          const playerHtml = await fetchWowPlayerPost(pid);
          if (!playerHtml) continue;

          // Extract iframe src
          const iframeMatch = playerHtml.match(/src="(.+?)"/);
          if (!iframeMatch) {
            addLog(`   [${j + 1}/${epBtns.length}] ${ename}: ไม่พบ src iframe`, "warn");
            continue;
          }

          const embedSrc = iframeMatch[1];
          let finalStreamUrl = embedSrc;

          if (embedSrc.includes("ok-hd.com") || embedSrc.includes("ok-player") || embedSrc.includes("vhash")) {
            // Get embed player html
            try {
              const baseUri = new URL(embedSrc).origin;
              const embedHtml = await fetchWowProxy(embedSrc, "https://wow-drama.com/");
              if (embedHtml) {
                const vhashMatch = embedHtml.match(/vhash\,\s*(\{.+?\})\,\s*false/);
                if (vhashMatch) {
                  const jddd = JSON.parse(vhashMatch[1]);
                  const { videoUrl, videoServer, videoDisk } = jddd;
                  const vDiskStr = videoDisk || "";
                  const playerReqUrl = `${baseUri}${videoUrl}?s=${videoServer}&d=${vDiskStr}`;

                  const playerM3uText = await fetchWowProxy(playerReqUrl, baseUri);
                  if (playerM3uText) {
                    const lines = playerM3uText.trim().split("\n").map(l => l.trim()).filter(Boolean);
                    const lastLine = lines[lines.length - 1];
                    if (lastLine && (lastLine.startsWith("http") || lastLine.startsWith("/"))) {
                      finalStreamUrl = lastLine.endsWith(".m3u8") || lastLine.endsWith(".m3u") ? lastLine : `${lastLine}.m3u`;
                    }
                  }
                }
              }
            } catch {
              // Fallback to embedSrc
            }
          }

          if (finalStreamUrl) {
            const resolvedUrl = fixUrl(finalStreamUrl);
            episodes.push({
              title: ename,
              url: resolvedUrl
            });
            addLog(`   ✅ [${j + 1}/${epBtns.length}] ${ename} → ${resolvedUrl.substring(0, 60)}...`, "success");
          }

          if (j < epBtns.length - 1) {
            await waitState(delayMs);
          }
        }

        if (episodes.length > 0) {
          totalSaved++;
          const newSeries: SeriesData = {
            id: purl,
            title: pname,
            poster: ppic,
            synopsis: `สถานะ: ${pstatus || "สมบูรณ์"} | ${pinfo}`,
            pageNum: page,
            episodes
          };

          setSeriesListWow((prev) => [newSeries, ...prev.filter(it => it.id !== newSeries.id)]);
        }
      }
    }

    setIsHarvesting(false);
    if (shouldStopRef.current) {
      addLog(`🛑 ยกเลิกภารกิจขุด WOW-Drama กลางทางเรียบร้อยแล้ว`, "warn");
    } else {
      addLog(`🎉 สารบัญ WOW-Drama เสร็จสิ้นเรียบร้อย! ค้นพบและบันทึกเพลย์ลิสต์ [ ${totalSaved} ] เรื่อง`, "success");
    }
  };

  // SerieDays Scraper Engine
  const editLinkSerieDays = (elink: string): string => {
    if (!elink || elink.includes("fileprocess.html")) return "";
    try {
      const raw = elink.startsWith("//") ? "https:" + elink : elink;
      const u = new URL(raw);
      const cid = u.searchParams.get("id") || "";
      const backup = parseInt(u.searchParams.get("backup") || "0", 10);
      const ptype = parseInt(u.searchParams.get("ptype") || "0", 10);

      if (!cid) return normalizeStreamUrl(raw);

      const purl = `${u.protocol}//${u.host}/`;
      if (raw.includes("https://main.")) {
        if (backup === 1) {
          return normalizeStreamUrl(`${purl}m3u8/${cid}/${cid}.m3u8`);
        }
        return normalizeStreamUrl(
          ptype === 2
            ? `https://main.24playerhd.com/m3u8/${cid}/${cid}.m3u8`
            : `${purl}newplaylist/${cid}/${cid}.m3u8`
        );
      } else if (raw.includes("https://hot.")) {
        if (backup === 1) {
          return normalizeStreamUrl(`${purl}newplaylist_g/${cid}/${cid}.m3u8`);
        }
        return normalizeStreamUrl(`${purl}newplaylist/${cid}/${cid}.m3u8`);
      }
      return normalizeStreamUrl(raw);
    } catch {
      return normalizeStreamUrl(elink);
    }
  };

  const fetchSerieDaysProxy = async (targetUrl: string, referer?: string) => {
    try {
      const urlParam = encodeURIComponent(targetUrl);
      const refererParam = referer ? `&referer=${encodeURIComponent(referer)}` : "";
      const res = await fetch(`/api/seriedays?url=${urlParam}${refererParam}`);
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  const fetchSerieDaysAjaxPost = async (formData: Record<string, any>) => {
    try {
      const res = await fetch(`/api/seriedays`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  const startHarvestingSerieDays = async () => {
    if (isHarvesting) return;
    shouldStopRef.current = false;
    setIsHarvesting(true);
    setIsPaused(false);

    if (clearPrevious) {
      setSeriesListSerieDays([]);
      setLogs([]);
    }

    addLog(`🚀 เริ่มขุดข้อมูล SerieDays (seriedays.com)... [หน้า ${startPageSerieDays} - ${endPageSerieDays}] [หมวดหมู่: ${categoryUrlSerieDays}]`, "success");

    let totalSaved = 0;

    for (let page = startPageSerieDays; page <= endPageSerieDays; page++) {
      if (shouldStopRef.current) break;

      let pageUrl = categoryUrlSerieDays;
      if (page > 1) {
        pageUrl = categoryUrlSerieDays.replace(/\/$/, "") + `/page/${page}/`;
      }

      addLog(`📂 [Page ${page}/${endPageSerieDays}] กำลังโหลดหน้า: ${pageUrl}`, "info");

      const html = await fetchSerieDaysProxy(pageUrl, "https://www.seriedays.com/");
      if (!html) {
        addLog(`⚠️ ไม่สามารถดึงข้อมูลหน้า ${page} ได้`, "warn");
        continue;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      const div = doc.querySelector(".grid-movie");
      const movieCards = div ? Array.from(div.querySelectorAll(".box")) : [];

      if (movieCards.length === 0) {
        addLog(`--- ไม่พบรายการซีรีส์ ในหน้า ${page} ---`, "warn");
        continue;
      }

      addLog(`🔍 พบคลังซีรีส์ในหน้า ${page} ทั้งหมด ${movieCards.length} เรื่อง`, "info");

      for (let sIndex = 0; sIndex < movieCards.length; sIndex++) {
        if (shouldStopRef.current) break;

        const card = movieCards[sIndex];
        const aLink = card.querySelector("a");
        const titleEl = card.querySelector(".p2");
        const boxImg = card.querySelector(".box-img img");
        const epSpan = card.querySelector("span.EP");

        const pname = titleEl ? titleEl.textContent?.trim() || "Unknown" : "Unknown";
        const ppic = boxImg ? (boxImg.getAttribute("data-lazy-src") || boxImg.getAttribute("src") || "") : "";
        const purl = aLink ? aLink.getAttribute("href") || "" : "";
        const pinfo = epSpan ? epSpan.textContent?.trim().replace(/\n/g, " ") || "" : "";

        if (!purl) continue;

        setCurrentProgress({
          page,
          seriesIndex: sIndex + 1,
          totalSeriesInPage: movieCards.length,
          currentSeriesName: pname
        });

        addLog(`🎬 [${sIndex + 1}/${movieCards.length}] ดึงข้อมูลเรื่อง: ${pname} (${pinfo || "ซีรีส์"})`, "info");

        // Fetch detail page
        const detailHtml = await fetchSerieDaysProxy(purl, pageUrl);
        if (!detailHtml) {
          addLog(`  ⚠️ ไม่สามารถโหลดรายละเอียดซีรีส์: ${pname}`, "warn");
          continue;
        }

        const detailDoc = parser.parseFromString(detailHtml, "text/html");
        const selectSeq = detailDoc.querySelector('select[name="Sequel_select"]');

        const episodes: Episode[] = [];

        if (!selectSeq) {
          // Single episode iframe
          const iframe = detailDoc.querySelector("iframe");
          const iframeSrc = iframe ? iframe.getAttribute("src") || "" : "";
          if (iframeSrc) {
            const elink = editLinkSerieDays(iframeSrc);
            if (elink) {
              episodes.push({ title: pname, url: elink });
              addLog(`   ✅ [1/1] ${pname} → ${elink.substring(0, 60)}...`, "success");
            } else {
              addLog(`   ⚠️ [1/1] ${pname}: ไม่สามารถสร้างลิงก์วิดีโอได้`, "warn");
            }
          } else {
            addLog(`   ⚠️ ไม่พบ iframe สำหรับ: ${pname}`, "warn");
          }
        } else {
          // Multiple episodes select
          const epOptions = Array.from(selectSeq.querySelectorAll("option"));

          for (let epIdx = 0; epIdx < epOptions.length; epIdx++) {
            if (shouldStopRef.current) break;

            const opt = epOptions[epIdx];
            const ename = opt.textContent?.trim() || `ตอนที่ ${epIdx + 1}`;
            const optVal = opt.getAttribute("value") || "";

            if (!optVal) continue;

            const epPageUrl = optVal.startsWith("http") ? optVal : `https://www.seriedays.com/${optVal.replace(/^\//, "")}`;

            const epHtml = await fetchSerieDaysProxy(epPageUrl, purl);
            if (!epHtml) continue;

            const epDoc = parser.parseFromString(epHtml, "text/html");
            const langSelect = epDoc.querySelector("#Lang_select");
            const langOptions = langSelect ? Array.from(langSelect.querySelectorAll("option")) : [];

            const lsub = epDoc.querySelector("span.halim-btn.halim-btn-2.active, span.halim-btn");
            const nonce = lsub ? lsub.getAttribute("data-type") || "" : "";
            const postid = lsub ? lsub.getAttribute("data-post-id") || "" : "";
            const server = lsub ? lsub.getAttribute("data-server") || "" : "";

            if (langOptions.length > 0) {
              for (const lOpt of langOptions) {
                if (shouldStopRef.current) break;

                const defaultOption = lOpt.getAttribute("value") || "";
                const tsub = defaultOption.replace("Thai", "พากย์ไทย").replace("Sound Track", "ซับไทย");

                const ajaxHtml = await fetchSerieDaysAjaxPost({
                  action: "halim_ajax_player",
                  nonce,
                  episode: epIdx + 1,
                  postid,
                  lang: defaultOption,
                  server
                });

                if (ajaxHtml) {
                  const ajaxDoc = parser.parseFromString(ajaxHtml, "text/html");
                  const ajaxIframe = ajaxDoc.querySelector("iframe");
                  const ajaxIframeSrc = ajaxIframe ? ajaxIframe.getAttribute("src") || "" : "";

                  if (ajaxIframeSrc) {
                    const elink = editLinkSerieDays(ajaxIframeSrc);
                    if (elink) {
                      episodes.push({
                        title: `${ename} (${tsub})`,
                        url: elink
                      });
                      addLog(`   ✅ [${epIdx + 1}/${epOptions.length}] ${ename} [${tsub}] → ${elink.substring(0, 60)}...`, "success");
                    }
                  }
                }
              }
            } else {
              // Fallback if no lang select
              const iframe = epDoc.querySelector("iframe");
              const iframeSrc = iframe ? iframe.getAttribute("src") || "" : "";
              if (iframeSrc) {
                const elink = editLinkSerieDays(iframeSrc);
                if (elink) {
                  episodes.push({
                    title: ename,
                    url: elink
                  });
                  addLog(`   ✅ [${epIdx + 1}/${epOptions.length}] ${ename} → ${elink.substring(0, 60)}...`, "success");
                }
              }
            }

            if (epIdx < epOptions.length - 1) {
              await waitState(delayMs);
            }
          }
        }

        if (episodes.length > 0) {
          totalSaved++;
          const newSeries: SeriesData = {
            id: purl,
            title: pname,
            poster: ppic,
            synopsis: `ข้อมูล: ${pinfo || "ซีรีส์"} | แหล่งข้อมูล: seriedays.com`,
            pageNum: page,
            episodes
          };

          setSeriesListSerieDays((prev) => [newSeries, ...prev.filter(it => it.id !== newSeries.id)]);
        }
      }
    }

    setIsHarvesting(false);
    if (shouldStopRef.current) {
      addLog(`🛑 ยกเลิกภารกิจขุด SerieDays กลางทางเรียบร้อยแล้ว`, "warn");
    } else {
      addLog(`🎉 สารบัญ SerieDays เสร็จสิ้นเรียบร้อย! ค้นพบและบันทึกเพลย์ลิสต์ [ ${totalSaved} ] เรื่อง`, "success");
    }
  };

  // 24HD Scraper Engine
  const fetch24HDProxy = async (targetUrl: string) => {
    try {
      const urlParam = encodeURIComponent(targetUrl);
      const res = await fetch(`/api/24hd?url=${urlParam}`);
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  const startHarvesting24HD = async () => {
    if (isHarvesting) return;
    shouldStopRef.current = false;
    setIsHarvesting(true);
    setIsPaused(false);

    if (clearPrevious) {
      setSeriesList24HD([]);
      setLogs([]);
    }

    addLog(`🚀 เริ่มขุดข้อมูล 24HD Movies (24hd.vip)... [หน้า ${startPage24HD} - ${endPage24HD}] [หมวดหมู่: ${categoryUrl24HD}]`, "success");

    let totalSaved = 0;

    for (let page = startPage24HD; page <= endPage24HD; page++) {
      if (shouldStopRef.current) break;

      let pageUrl = categoryUrl24HD;
      if (page > 1) {
        pageUrl = categoryUrl24HD.replace(/\/$/, "") + `/page/${page}/`;
      }

      addLog(`📂 [Page ${page}/${endPage24HD}] กำลังโหลดหน้า: ${pageUrl}`, "info");

      const html = await fetch24HDProxy(pageUrl);
      if (!html) {
        addLog(`⚠️ ไม่สามารถดึงข้อมูลหน้า ${page} ได้`, "warn");
        continue;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Extract movie links from loop container
      const loopContainer = doc.querySelector(".elementor-loop-container");
      const aTags = loopContainer ? Array.from(loopContainer.querySelectorAll("a[href]")) : Array.from(doc.querySelectorAll("a[href]"));

      const movieLinksMap = new Map<string, { url: string; title: string; image: string }>();

      aTags.forEach((a) => {
        const href = a.getAttribute("href") || "";
        if (href && !href.includes("/category/") && !href.includes("#") && href.startsWith("http")) {
          if (!movieLinksMap.has(href)) {
            // Title
            let title = "";
            const titleDiv = a.querySelector("div[class*='d793f5f']") || a.querySelector(".elementor-heading-title");
            if (titleDiv) {
              title = titleDiv.textContent?.trim() || "";
            }
            if (!title) {
              const slug = href.replace(/\/$/, "").split("/").pop() || "";
              title = slug.replace(/-/g, " ");
            }

            // Image
            let imgUrl = "";
            const bgDiv = a.querySelector("div[style*='background-image']");
            if (bgDiv) {
              const style = bgDiv.getAttribute("style") || "";
              const match = style.match(/background-image:\s*url\(["']?([^"'\)]+)["']?\)/i);
              if (match) imgUrl = match[1];
            }
            if (!imgUrl) {
              const imgEl = a.querySelector("img");
              if (imgEl) {
                imgUrl = imgEl.getAttribute("src") || imgEl.getAttribute("data-src") || "";
              }
            }

            movieLinksMap.set(href, { url: href, title, image: imgUrl });
          }
        }
      });

      const movieLinks = Array.from(movieLinksMap.values());

      if (movieLinks.length === 0) {
        addLog(`--- ไม่พบรายการภาพยนตร์ ในหน้า ${page} ---`, "warn");
        continue;
      }

      addLog(`🔍 พบคลังภาพยนตร์ในหน้า ${page} ทั้งหมด ${movieLinks.length} เรื่อง`, "info");

      for (let mIndex = 0; mIndex < movieLinks.length; mIndex++) {
        if (shouldStopRef.current) break;

        const movie = movieLinks[mIndex];

        setCurrentProgress({
          page,
          seriesIndex: mIndex + 1,
          totalSeriesInPage: movieLinks.length,
          currentSeriesName: movie.title
        });

        addLog(`🎬 [${mIndex + 1}/${movieLinks.length}] ดึงข้อมูลเรื่อง: ${movie.title}`, "info");

        const detailHtml = await fetch24HDProxy(movie.url);
        if (!detailHtml) {
          addLog(`  ⚠️ ไม่สามารถโหลดรายละเอียด: ${movie.title}`, "warn");
          continue;
        }

        const detailDoc = parser.parseFromString(detailHtml, "text/html");

        // Movie title
        const h1 = detailDoc.querySelector("h1.elementor-heading-title, h2.elementor-heading-title");
        const movieTitle = h1 ? h1.textContent?.trim() || movie.title : movie.title;

        // Cover image
        const ogImage = detailDoc.querySelector("meta[property='og:image']");
        let coverUrl = ogImage ? ogImage.getAttribute("content") || "" : "";
        if (!coverUrl) {
          const fullImg = detailDoc.querySelector("img.attachment-full, img[class*='wp-image']");
          if (fullImg) {
            coverUrl = fullImg.getAttribute("src") || fullImg.getAttribute("data-src") || "";
          }
        }
        if (!coverUrl) coverUrl = movie.image;

        // Audio info
        let audioInfo = "พากย์ไทย/ซับไทย";
        const headings = Array.from(detailDoc.querySelectorAll("h2.elementor-heading-title"));
        for (const h2 of headings) {
          const txt = h2.textContent?.trim() || "";
          if (txt.includes("เสียง :") || txt.includes("เสียง:") || txt.includes("เสียง")) {
            if (txt.includes(":")) audioInfo = txt.split(":")[1].trim();
            else if (txt.includes("：")) audioInfo = txt.split("：")[1].trim();
            else audioInfo = txt.replace("เสียง", "").trim();
            break;
          }
        }

        // Helper function to resolve embed link or m3u8 URL to direct m3u8 playlist
        const resolveStreamUrl = (cand: string): string => {
          if (!cand) return "";
          let embedId = "";
          if (cand.includes("playermhd.p2phls.xyz/embed/")) {
            embedId = cand.split("/embed/")[1]?.split("?")[0]?.replace(/\/$/, "") || "";
          } else if (cand.includes("player77hdfree.xyz/embed/")) {
            embedId = cand.split("/embed/")[1]?.split("?")[0]?.replace(/\/$/, "") || "";
          } else if (cand.includes("vdohls.com/")) {
            const match = cand.match(/vdohls\.com\/([a-zA-Z0-9_-]+)/);
            if (match) embedId = match[1];
          }

          if (embedId && embedId !== "about:blank") {
            return `https://vdohls.com/${embedId}/playlist.m3u8`;
          } else if (cand.includes(".m3u8")) {
            return normalizeStreamUrl(cand);
          }
          return "";
        };

        // Extract episodes
        const extractedEpisodes: Episode[] = [];

        // 1. Try finding episode buttons (.swicth-ep, button[data-link], [data-link])
        const epElements = Array.from(detailDoc.querySelectorAll(".swicth-ep, [data-link], button[data-link]"));
        const seenUrls = new Set<string>();

        epElements.forEach((el) => {
          const rawLink = el.getAttribute("data-link") || el.getAttribute("data-link2") || "";
          const resolvedUrl = resolveStreamUrl(rawLink);
          if (resolvedUrl && !seenUrls.has(resolvedUrl)) {
            seenUrls.add(resolvedUrl);
            let epTitle = el.textContent?.trim() || "";
            if (!epTitle || epTitle === "ตัวเล่นหลัก") {
              epTitle = `${movieTitle} EP.${extractedEpisodes.length + 1}`;
            }
            extractedEpisodes.push({
              title: epTitle,
              url: resolvedUrl
            });
          }
        });

        // 2. If no multi-episode buttons found, fallback to single movie iframe / links
        if (extractedEpisodes.length === 0) {
          const iframeList = Array.from(detailDoc.querySelectorAll("iframe"));
          const linkList = Array.from(detailDoc.querySelectorAll("a[href]"));

          const candidates: string[] = [
            ...iframeList.map(i => i.getAttribute("src") || i.getAttribute("data-src") || ""),
            ...linkList.map(l => l.getAttribute("href") || "")
          ].filter(Boolean);

          for (const cand of candidates) {
            const stUrl = resolveStreamUrl(cand);
            if (stUrl) {
              extractedEpisodes.push({
                title: `${movieTitle} [${audioInfo}]`,
                url: stUrl
              });
              break;
            }
          }
        }

        if (extractedEpisodes.length > 0) {
          totalSaved++;
          const newSeries: SeriesData = {
            id: movie.url,
            title: movieTitle,
            poster: coverUrl,
            synopsis: `เสียง: ${audioInfo} | จำนวน: ${extractedEpisodes.length} ตอน | แหล่งข้อมูล: 24hd.vip`,
            pageNum: page,
            episodes: extractedEpisodes
          };

          setSeriesList24HD((prev) => [newSeries, ...prev.filter(it => it.id !== newSeries.id)]);
          addLog(`   ✅ [${extractedEpisodes.length} EP] ${movieTitle} → ${extractedEpisodes[0].url.substring(0, 50)}...`, "success");
        } else {
          addLog(`   ⚠️ ไม่พบลิงก์วิดีโอ (embed/m3u8) สำหรับ: ${movieTitle}`, "warn");
        }

        if (mIndex < movieLinks.length - 1) {
          await waitState(delayMs);
        }
      }
    }

    setIsHarvesting(false);
    if (shouldStopRef.current) {
      addLog(`🛑 ยกเลิกภารกิจขุด 24HD Movies กลางทางเรียบร้อยแล้ว`, "warn");
    } else {
      addLog(`🎉 สารบัญ 24HD Movies เสร็จสิ้นเรียบร้อย! ค้นพบและบันทึกเพลย์ลิสต์ [ ${totalSaved} ] เรื่อง`, "success");
    }
  };

  const fetchDDNungProxy = async (targetUrl: string) => {
    try {
      const urlParam = encodeURIComponent(targetUrl);
      const res = await fetch(`/api/ddnung?url=${urlParam}`);
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  };

  const startHarvestingDDNung = async () => {
    if (isHarvesting) return;
    shouldStopRef.current = false;
    setIsHarvesting(true);
    setIsPaused(false);

    if (clearPrevious) {
      setSeriesListDDNung([]);
      setLogs([]);
    }

    addLog(`🚀 เริ่มขุดข้อมูล DDNUNG (ddnung.com)... [หน้า ${startPageDDNung} - ${endPageDDNung}] [หมวดหมู่: ${categoryUrlDDNung}]`, "success");

    let totalSaved = 0;

    for (let page = startPageDDNung; page <= endPageDDNung; page++) {
      if (shouldStopRef.current) break;

      let pageUrl = categoryUrlDDNung;
      if (page > 1) {
        pageUrl = categoryUrlDDNung.replace(/\/$/, "") + `/page/${page}/`;
      }

      addLog(`📂 [Page ${page}/${endPageDDNung}] กำลังโหลดหน้า: ${pageUrl}`, "info");

      const html = await fetchDDNungProxy(pageUrl);
      if (!html) {
        addLog(`⚠️ ไม่สามารถดึงข้อมูลหน้า ${page} ได้`, "warn");
        continue;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // Extract movie/series links from loop container or general anchors
      const loopContainer = doc.querySelector(".elementor-loop-container");
      const aTags = loopContainer ? Array.from(loopContainer.querySelectorAll("a[href]")) : Array.from(doc.querySelectorAll("a[href]"));

      const movieLinksMap = new Map<string, { url: string; title: string; image: string }>();

      aTags.forEach((a) => {
        const href = a.getAttribute("href") || "";
        if (href && !href.includes("/category/") && !href.includes("/series-country/") && !href.includes("#") && href.startsWith("http")) {
          if (!movieLinksMap.has(href)) {
            // Title
            let title = "";
            const titleDiv = a.querySelector("div[class*='d793f5f']") || a.querySelector(".elementor-heading-title");
            if (titleDiv) {
              title = titleDiv.textContent?.trim() || "";
            }
            if (!title) {
              const slug = href.replace(/\/$/, "").split("/").pop() || "";
              title = slug.replace(/-/g, " ");
            }

            // Image
            let imgUrl = "";
            const bgDiv = a.querySelector("div[style*='background-image']");
            if (bgDiv) {
              const style = bgDiv.getAttribute("style") || "";
              const match = style.match(/background-image:\s*url\(["']?([^"'\)]+)["']?\)/i);
              if (match) imgUrl = match[1];
            }
            if (!imgUrl) {
              const imgEl = a.querySelector("img");
              if (imgEl) {
                imgUrl = imgEl.getAttribute("src") || imgEl.getAttribute("data-src") || "";
              }
            }

            movieLinksMap.set(href, { url: href, title, image: imgUrl });
          }
        }
      });

      const movieLinks = Array.from(movieLinksMap.values());

      if (movieLinks.length === 0) {
        addLog(`--- ไม่พบรายการภาพยนตร์/ซีรีย์ ในหน้า ${page} ---`, "warn");
        continue;
      }

      addLog(`🔍 พบคลังหนัง/ซีรีย์ในหน้า ${page} ทั้งหมด ${movieLinks.length} เรื่อง`, "info");

      for (let mIndex = 0; mIndex < movieLinks.length; mIndex++) {
        if (shouldStopRef.current) break;

        const movie = movieLinks[mIndex];

        setCurrentProgress({
          page,
          seriesIndex: mIndex + 1,
          totalSeriesInPage: movieLinks.length,
          currentSeriesName: movie.title
        });

        addLog(`🎬 [${mIndex + 1}/${movieLinks.length}] ดึงข้อมูลเรื่อง: ${movie.title}`, "info");

        const detailHtml = await fetchDDNungProxy(movie.url);
        if (!detailHtml) {
          addLog(`  ⚠️ ไม่สามารถโหลดรายละเอียด: ${movie.title}`, "warn");
          continue;
        }

        const detailDoc = parser.parseFromString(detailHtml, "text/html");

        // Title
        const h1 = detailDoc.querySelector("h1.elementor-heading-title, h2.elementor-heading-title");
        const movieTitle = h1 ? h1.textContent?.trim() || movie.title : movie.title;

        // Cover image
        const ogImage = detailDoc.querySelector("meta[property='og:image']");
        let coverUrl = ogImage ? ogImage.getAttribute("content") || "" : "";
        if (!coverUrl) {
          const fullImg = detailDoc.querySelector("img.attachment-full, img[class*='wp-image']");
          if (fullImg) {
            coverUrl = fullImg.getAttribute("src") || fullImg.getAttribute("data-src") || "";
          }
        }
        if (!coverUrl) coverUrl = movie.image;

        // Audio info
        let audioInfo = "พากย์ไทย/ซับไทย";
        const headings = Array.from(detailDoc.querySelectorAll("h2.elementor-heading-title"));
        for (const h2 of headings) {
          const txt = h2.textContent?.trim() || "";
          if (txt.includes("เสียง :") || txt.includes("เสียง:") || txt.includes("เสียง")) {
            if (txt.includes(":")) audioInfo = txt.split(":")[1].trim();
            else if (txt.includes("：")) audioInfo = txt.split("：")[1].trim();
            else audioInfo = txt.replace("เสียง", "").trim();
            break;
          }
        }

        // Helper function to resolve embed link or m3u8 URL to direct m3u8 playlist
        const resolveStreamUrlDDNung = (cand: string): string => {
          if (!cand) return "";
          let embedId = "";
          if (cand.includes("playdd.seetvplay.xyz/embed/")) {
            embedId = cand.split("/embed/")[1]?.split("?")[0]?.replace(/\/$/, "") || "";
          } else if (cand.includes("hplay.hdplayfull.xyz/embed/")) {
            embedId = cand.split("/embed/")[1]?.split("?")[0]?.replace(/\/$/, "") || "";
          } else if (cand.includes("player77hdfree.xyz/embed/")) {
            embedId = cand.split("/embed/")[1]?.split("?")[0]?.replace(/\/$/, "") || "";
          } else if (cand.includes("playermhd.p2phls.xyz/embed/")) {
            embedId = cand.split("/embed/")[1]?.split("?")[0]?.replace(/\/$/, "") || "";
          } else if (cand.includes("vdohls.com/")) {
            const match = cand.match(/vdohls\.com\/([a-zA-Z0-9_-]+)/);
            if (match) embedId = match[1];
          } else if (cand.includes("/embed/")) {
            const match = cand.match(/\/embed\/([a-zA-Z0-9_-]+)/);
            if (match) embedId = match[1];
          }

          if (embedId && embedId !== "about:blank") {
            return `https://vdohls.com/${embedId}/playlist.m3u8`;
          } else if (cand.includes(".m3u8")) {
            return normalizeStreamUrl(cand);
          }
          return "";
        };

        // Extract episodes
        const extractedEpisodes: Episode[] = [];

        // 1. Try finding episode buttons (.swicth-ep, button[data-link], [data-link])
        const epElements = Array.from(detailDoc.querySelectorAll(".swicth-ep, [data-link], button[data-link]"));
        const seenUrls = new Set<string>();

        epElements.forEach((el) => {
          const rawLink = el.getAttribute("data-link") || el.getAttribute("data-link2") || "";
          const resolvedUrl = resolveStreamUrlDDNung(rawLink);
          if (resolvedUrl && !seenUrls.has(resolvedUrl)) {
            seenUrls.add(resolvedUrl);
            let epTitle = el.textContent?.trim() || "";
            if (!epTitle || epTitle === "ตัวเล่นหลัก") {
              epTitle = `${movieTitle} EP.${extractedEpisodes.length + 1}`;
            }
            extractedEpisodes.push({
              title: epTitle,
              url: resolvedUrl
            });
          }
        });

        // 2. If no multi-episode buttons found, fallback to single movie iframe / links
        if (extractedEpisodes.length === 0) {
          const iframeList = Array.from(detailDoc.querySelectorAll("iframe"));
          const linkList = Array.from(detailDoc.querySelectorAll("a[href]"));

          const candidates: string[] = [
            ...iframeList.map(i => i.getAttribute("src") || i.getAttribute("data-src") || ""),
            ...linkList.map(l => l.getAttribute("href") || "")
          ].filter(Boolean);

          for (const cand of candidates) {
            const stUrl = resolveStreamUrlDDNung(cand);
            if (stUrl) {
              extractedEpisodes.push({
                title: `${movieTitle} [${audioInfo}]`,
                url: stUrl
              });
              break;
            }
          }
        }

        if (extractedEpisodes.length > 0) {
          totalSaved++;
          const newSeries: SeriesData = {
            id: movie.url,
            title: movieTitle,
            poster: coverUrl,
            synopsis: `เสียง: ${audioInfo} | จำนวน: ${extractedEpisodes.length} ตอน | แหล่งข้อมูล: ddnung.com`,
            pageNum: page,
            episodes: extractedEpisodes
          };

          setSeriesListDDNung((prev) => [newSeries, ...prev.filter(it => it.id !== newSeries.id)]);
          addLog(`   ✅ [${extractedEpisodes.length} EP] ${movieTitle} → ${extractedEpisodes[0].url.substring(0, 50)}...`, "success");
        } else {
          addLog(`   ⚠️ ไม่พบลิงก์วิดีโอ (embed/m3u8) สำหรับ: ${movieTitle}`, "warn");
        }

        if (mIndex < movieLinks.length - 1) {
          await waitState(delayMs);
        }
      }
    }

    setIsHarvesting(false);
    if (shouldStopRef.current) {
      addLog(`🛑 ยกเลิกภารกิจขุด DDNUNG กลางทางเรียบร้อยแล้ว`, "warn");
    } else {
      addLog(`🎉 สารบัญ DDNUNG เสร็จสิ้นเรียบร้อย! ค้นพบและบันทึกเพลย์ลิสต์ [ ${totalSaved} ] เรื่อง`, "success");
    }
  };

  const startHarvestingMoviesDooFree = async () => {
    if (isHarvesting) return;
    setIsHarvesting(true);
    setIsPaused(false);
    shouldStopRef.current = false;

    if (clearPrevious) {
      setSeriesListMoviesDooFree([]);
    }

    addLog(`🚀 เริ่มต้นภารกิจขุดค้น MoviesDooFree (moviesdoofree.com) [ หน้า ${startPageMoviesDooFree} ถึง ${endPageMoviesDooFree} ]`, "info");

    let totalSaved = 0;
    const cleanBaseUrl = baseUrlMoviesDooFree.replace(/\/$/, "");

    for (let page = startPageMoviesDooFree; page <= endPageMoviesDooFree; page++) {
      if (shouldStopRef.current) break;

      const pageUrl = page === 1 ? `${cleanBaseUrl}/` : `${cleanBaseUrl}/page/${page}/`;
      setCurrentProgress({
        page,
        seriesIndex: 0,
        totalSeriesInPage: 0,
        currentSeriesName: `กำลังอ่านหน้าสารบัญ ${page}`
      });

      addLog(`📄 [PAGE ${page}] กำลังดึงรายการหนังจาก: ${pageUrl}`, "info");

      let pageHtml: string | null = null;
      try {
        const proxyUrl = `/api/moviesdoofree?url=${encodeURIComponent(pageUrl)}`;
        const res = await fetch(proxyUrl);
        if (res.ok) {
          pageHtml = await res.text();
        }
      } catch (e: any) {
        addLog(`❌ ดึงข้อมูลหน้า ${page} ไม่สำเร็จ: ${e.message}`, "error");
      }

      if (!pageHtml) {
        addLog(`⚠️ ไม่สามารถอ่านข้อมูลหน้า ${page} ได้ ข้ามไปหน้าถัดไป`, "warn");
        continue;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(pageHtml, "text/html");
      const boxes = Array.from(doc.querySelectorAll("div.movie-box"));

      const movieLinks: { title: string; href: string; img: string }[] = [];
      boxes.forEach((box) => {
        const titleA = box.querySelector("div.movie-title a");
        const href = titleA?.getAttribute("href") || "";
        const imgEl = box.querySelector("img");
        const img = imgEl?.getAttribute("src") || imgEl?.getAttribute("data-src") || "";
        const title = titleA?.textContent?.trim() || imgEl?.getAttribute("alt") || "";

        if (href) {
          const fullHref = href.startsWith("http") ? href : `${cleanBaseUrl}${href.startsWith("/") ? "" : "/"}${href}`;
          movieLinks.push({ title, href: fullHref, img });
        }
      });

      addLog(`✅ [PAGE ${page}] ค้นพบภาพยนตร์ทั้งหมด ${movieLinks.length} เรื่อง`, "success");

      setCurrentProgress({
        page,
        seriesIndex: 0,
        totalSeriesInPage: movieLinks.length,
        currentSeriesName: `เตรียมขุดรายละเอียด ${movieLinks.length} เรื่อง`
      });

      for (let mIndex = 0; mIndex < movieLinks.length; mIndex++) {
        if (shouldStopRef.current) break;

        const movie = movieLinks[mIndex];
        setCurrentProgress({
          page,
          seriesIndex: mIndex + 1,
          totalSeriesInPage: movieLinks.length,
          currentSeriesName: movie.title || movie.href
        });

        addLog(`  🎬 [${mIndex + 1}/${movieLinks.length}] กำลังขุด: ${movie.title || movie.href}`, "info");

        let detailHtml: string | null = null;
        try {
          const detailProxy = `/api/moviesdoofree?url=${encodeURIComponent(movie.href)}`;
          const res = await fetch(detailProxy);
          if (res.ok) {
            detailHtml = await res.text();
          }
        } catch (e: any) {
          addLog(`   ❌ ไม่สามารถดึงหน้ารายละเอียด: ${movie.href}`, "error");
        }

        if (!detailHtml) {
          addLog(`   ⚠️ อ่านรายละเอียดล้มเหลว ข้ามเรื่องนี้`, "warn");
          continue;
        }

        const detailDoc = parser.parseFromString(detailHtml, "text/html");
        const pxLeft = detailDoc.querySelector("div.px-left");
        const pxImg = pxLeft?.querySelector("img");
        const coverUrl = pxImg?.getAttribute("src") || movie.img || "https://img1.pic.in.th/images/MoviesdssFree.jpg";
        const movieTitle = pxImg?.getAttribute("alt") || detailDoc.querySelector("h1")?.textContent?.trim() || movie.title || "ไม่ระบุชื่อเรื่อง";

        // Extract story / synopsis
        const storyEl = detailDoc.querySelector("div.story") || detailDoc.querySelector("div[itemprop='description']");
        const synopsis = storyEl?.textContent?.trim() || `แหล่งข้อมูล: moviesdoofree.com`;

        // Extract video iframe stream (m3u8haha.com)
        let streamUrl = "";
        const iframes = Array.from(detailDoc.querySelectorAll("iframe"));
        for (const iframe of iframes) {
          const src = iframe.getAttribute("src") || iframe.getAttribute("data-src") || "";
          const vidMatch = src.match(/vid=([A-Z0-9]+)/i);
          if (vidMatch && vidMatch[1]) {
            streamUrl = `https://m3u8haha.com/movie/${vidMatch[1]}.mp4/playlist.m3u8`;
            break;
          }
        }

        // Fallback: check all iframes
        if (!streamUrl) {
          for (const iframe of iframes) {
            const src = iframe.getAttribute("src") || iframe.getAttribute("data-src") || "";
            if (src.includes(".m3u8") || src.includes("play.php")) {
              streamUrl = src;
              break;
            }
          }
        }

        if (streamUrl) {
          totalSaved++;
          const newSeries: SeriesData = {
            id: movie.href,
            title: movieTitle,
            poster: coverUrl,
            synopsis: synopsis,
            pageNum: page,
            episodes: [
              {
                title: movieTitle,
                url: streamUrl
              }
            ]
          };

          setSeriesListMoviesDooFree((prev) => [newSeries, ...prev.filter(it => it.id !== newSeries.id)]);
          addLog(`   ✅ [STREAM FOUND] ${movieTitle} → ${streamUrl}`, "success");
        } else {
          addLog(`   ⚠️ ไม่พบลิงก์เล่นวิดีโอ (iframe play.php/vid=) สำหรับ: ${movieTitle}`, "warn");
        }

        if (mIndex < movieLinks.length - 1) {
          await waitState(delayMs);
        }
      }
    }

    setIsHarvesting(false);
    if (shouldStopRef.current) {
      addLog(`🛑 ยกเลิกภารกิจขุด MoviesDooFree กลางทางเรียบร้อยแล้ว`, "warn");
    } else {
      addLog(`🎉 สารบัญ MoviesDooFree เสร็จสิ้นเรียบร้อย! ค้นพบและบันทึกเพลย์ลิสต์ [ ${totalSaved} ] เรื่อง`, "success");
    }
  };

  const handleConvertW3U = () => {
    if (!w3uRawText.trim()) {
      addLog("⚠️ ไม่พบข้อมูล W3U JSON กรุณาอัพโหลดไฟล์หรือวางข้อความก่อนแปลงค่า!", "error");
      return;
    }

    try {
      addLog("🔄 กำลังเริ่มต้นกระบวนการถอนรหัสไฟล์ W3U / Movie JSON Playlist...", "info");
      const json = JSON.parse(w3uRawText);
      const results = parseW3UContent(json, w3uExtraFlags);
      if (results.length === 0) {
        addLog("⚠️ คำเตือน: ไม่พบสถานีช่องรายการใดๆ ที่ถูกต้องสำหรับการแปลงผลลัพธ์", "warn");
      } else {
        const totalEps = results.reduce((acc, curr) => acc + curr.episodes.length, 0);
        addLog(`🎉 แปลงผลลัพธ์สำเร็จลุล่วง! พบกลุ่มรายการ [ ${results.length} ] กลุ่ม และช่องสถานีทั้งหมด [ ${totalEps} ] ช่อง`, "success");
      }

      setSeriesListW3u(results);
    } catch (err: any) {
      addLog(`❌ แปลงข้อมูลล้มเหลว: รูปแบบ JSON ผิดพลาดหรือโครงสร้างไม่อยู่ในมาตรฐาน (${err.message || err})`, "error");
    }
  };

  const handleTestProxyRequest = async () => {
    if (!proxyTargetUrl.trim()) {
      addLog("⚠️ กรุณาระบุ Target URL สำหรับ Proxy", "error");
      return;
    }

    setIsTestingProxy(true);
    setProxyStatus("FETCHING...");
    setProxyTestResult("กำลังส่งคำขอไปยังระบบ Proxy Referer Server...");

    try {
      const proxyEndpoint = `/proxy/?url=${encodeURIComponent(proxyTargetUrl.trim())}&referer=${encodeURIComponent(proxyReferer.trim())}`;
      addLog(`🌐 [PROXY] Sending request: GET ${proxyEndpoint}`, "info");

      const { res, duration: elapsed } = await fetchWithTiming(proxyEndpoint, { cache: "no-store" });

      const contentType = res.headers.get("content-type") || "unknown";
      setProxyStatus(`STATUS: ${res.status} ${res.statusText} (${elapsed}ms)`);

      const text = await res.text();
      const snippet = text.slice(0, 1500);

      setProxyTestResult(`[RESPONSE HEADERS]\nContent-Type: ${contentType}\nStatus: ${res.status}\nTime: ${elapsed}ms\n\n[CONTENT SNIPPET (First 1500 chars)]\n${snippet}`);

      if (res.ok) {
        addLog(`✅ [PROXY SUCCESS] ${res.status} OK (${elapsed}ms) - Content-Type: ${contentType}`, "success");
      } else {
        addLog(`⚠️ [PROXY ERROR] ${res.status} ${res.statusText} (${elapsed}ms)`, "error");
      }
    } catch (err: any) {
      setProxyStatus("ERROR");
      setProxyTestResult(`Error: ${err.message || String(err)}`);
      addLog(`❌ [PROXY FAILED] ${err.message || String(err)}`, "error");
    } finally {
      setIsTestingProxy(false);
    }
  };

  // Unified trigger based on activeTab
  const handleExecuteActiveHarvester = () => {
    if (activeTab === "okserietv" || activeTab === "kubhd24") {
      startHarvesting();
    } else if (activeTab === "123hdtv") {
      startHarvesting123HD();
    } else if (activeTab === "ezmovie") {
      startHarvestingEzMovie();
    } else if (activeTab === "wowdrama") {
      startHarvestingWowDrama();
    } else if (activeTab === "seriedays") {
      startHarvestingSerieDays();
    } else if (activeTab === "24hd") {
      startHarvesting24HD();
    } else if (activeTab === "ddnung") {
      startHarvestingDDNung();
    } else if (activeTab === "moviesdoofree") {
      startHarvestingMoviesDooFree();
    } else if (activeTab === "w3u") {
      handleConvertW3U();
    } else if (activeTab === "proxy") {
      handleTestProxyRequest();
    } else {
      startHarvestingDoonang();
    }
  };

  // Toggle pause trigger gracefully
  const togglePause = () => {
    setIsPaused((prev) => {
      const targetState = !prev;
      addLog(targetState ? "⏸️ หยุดพักสคริปต์การขุดข้อมูลชั่วคราว..." : "▶️ ทำงานต่อจากความเร่งรีบ...", "warn");
      return targetState;
    });
  };

  // Graceful stopping
  const stopHarvesting = () => {
    shouldStopRef.current = true;
    setIsPaused(false);
    setIsHarvesting(false);
    addLog("🛑 ทำการส่งคำขอยกเลิกแบบปลอดภัย รอเซกเมนต์ปัจจุบันคืนค่า...", "error");
  };

  // Clear logs terminal block
  const clearLogs = () => {
    setLogs([]);
    addLog("🧹 เคลียร์บอร์ดสเตตัสคอนโซลเรียบร้อย", "info");
  };

  // Helper arrays for different active tabs
  const activeSeriesList = useMemo(() => {
    if (activeTab === "okserietv" || activeTab === "kubhd24") return seriesList;
    if (activeTab === "123hdtv") return seriesList123;
    if (activeTab === "ezmovie") return seriesListEz;
    if (activeTab === "wowdrama") return seriesListWow;
    if (activeTab === "seriedays") return seriesListSerieDays;
    if (activeTab === "24hd") return seriesList24HD;
    if (activeTab === "ddnung") return seriesListDDNung;
    if (activeTab === "moviesdoofree") return seriesListMoviesDooFree;
    if (activeTab === "w3u") return seriesListW3u;
    return seriesListDoonang;
  }, [activeTab, seriesList, seriesList123, seriesListDoonang, seriesListEz, seriesListWow, seriesListSerieDays, seriesList24HD, seriesListDDNung, seriesListMoviesDooFree, seriesListW3u]);

  const fixUrl = (url: string) => {
    return normalizeStreamUrl(url);
  };

  const cleanName = (text: string) => {
    if (!text) return "Unknown";
    return text.replace(/\n/g, " ").replace(/,/g, " ").trim();
  };

  // Generate full individual M3U playlist file content following Python VOD converter spec
  const generateM3UOfSeries = (item: SeriesData): string => {
    const playlist: string[] = ["#EXTM3U", "#EXT-X-PLAYLIST-TYPE:VOD"];
    const title = cleanName(item.title);
    const poster = item.poster || "";

    item.episodes.forEach((ep: any) => {
      let rawEpName = ep.title || ep.episode_name || "EP";
      if (rawEpName.startsWith(title)) {
        rawEpName = rawEpName.slice(title.length).trim() || "EP";
      }
      const episode = cleanName(rawEpName);

      const url = fixUrl(ep.url || ep.original_url || ep.stream_url || "");
      if (!url) return;

      const group = ep.groupTitle ? cleanName(ep.groupTitle) : title;
      const logo = ep.tvgLogo || poster;
      const tvgId = ep.tvgId ? cleanName(ep.tvgId) : encodeURIComponent(title);

      const extinf = `#EXTINF:-1 tvg-id="${tvgId}" tvg-logo="${logo}" group-title="${group}",${title} - ${episode}`;
      playlist.push(extinf);
      playlist.push(url);

      if (w3uExtraFlags && ep.userAgent) {
        playlist.push(`#EXTVLCOPT:http-user-agent=${ep.userAgent}`);
      }
    });

    return playlist.join("\n");
  };

  // Generate 123HDTV JSON data
  const generateJSONOfSeries = (series: SeriesData): string => {
    const rawData = {
      id: series.id || "",
      name: series.title || "",
      category: "ซีรีส์",
      info: {
        poster: series.poster || "",
        description: series.synopsis || "",
        year: new Date().getFullYear()
      },
      seasons: [
        {
          season: 1,
          name: "Season 1",
          info: {
            poster: series.poster || "",
            description: series.synopsis || "",
            year: new Date().getFullYear()
          },
          episodes: series.episodes.map((ep, idx) => ({
            episode: idx + 1,
            name: ep.title,
            video: ep.url || "",
            subtitle: "",
            referrer: "https://www.123hdtv.com"
          }))
        }
      ]
    };
    return JSON.stringify([rawData], null, 2);
  };

  // Generate a singular single-click merge file of ALL harvested serials
  const generateMergedM3U = (): string => {
    const playlist: string[] = ["#EXTM3U", "#EXT-X-PLAYLIST-TYPE:VOD"];

    activeSeriesList.forEach((item) => {
      const title = cleanName(item.title);
      const poster = item.poster || "";

      item.episodes.forEach((ep: any) => {
        let rawEpName = ep.title || ep.episode_name || "EP";
        if (rawEpName.startsWith(title)) {
          rawEpName = rawEpName.slice(title.length).trim() || "EP";
        }
        const episode = cleanName(rawEpName);

        const url = fixUrl(ep.url || ep.original_url || ep.stream_url || "");
        if (!url) return;

        const group = ep.groupTitle ? cleanName(ep.groupTitle) : title;
        const logo = ep.tvgLogo || poster;
        const tvgId = ep.tvgId ? cleanName(ep.tvgId) : encodeURIComponent(title);

        const extinf = `#EXTINF:-1 tvg-id="${tvgId}" tvg-logo="${logo}" group-title="${group}",${title} - ${episode}`;
        playlist.push(extinf);
        playlist.push(url);

        if (w3uExtraFlags && ep.userAgent) {
          playlist.push(`#EXTVLCOPT:http-user-agent=${ep.userAgent}`);
        }
      });
    });

    return playlist.join("\n");
  };

  // Trigger file download to local PC
  const downloadM3U = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog(`📥 ดาวน์โหลดคลังเพลลิตส์สำเร็จ: ${filename}`, "success");
  };

  // Handle single-line copies
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Derived filtered listing via keyword matching
  const filteredSeriesList = useMemo(() => {
    if (!searchQuery) return activeSeriesList;
    const query = searchQuery.toLowerCase().trim();
    return activeSeriesList.filter((item) => 
      item.title.toLowerCase().includes(query) || 
      item.id.toLowerCase().includes(query)
    );
  }, [activeSeriesList, searchQuery]);

  // Selection & Batch deletion helper logic
  const deleteSeriesListByIds = (idsToDelete: string[]) => {
    const idsSet = new Set(idsToDelete);
    const filterFn = (prev: SeriesData[]) => prev.filter((item) => !idsSet.has(item.id));

    if (activeTab === "okserietv" || activeTab === "kubhd24") setSeriesList(filterFn);
    else if (activeTab === "123hdtv") setSeriesList123(filterFn);
    else if (activeTab === "doonang") setSeriesListDoonang(filterFn);
    else if (activeTab === "ezmovie") setSeriesListEz(filterFn);
    else if (activeTab === "wowdrama") setSeriesListWow(filterFn);
    else if (activeTab === "seriedays") setSeriesListSerieDays(filterFn);
    else if (activeTab === "24hd") setSeriesList24HD(filterFn);
    else if (activeTab === "ddnung") setSeriesListDDNung(filterFn);
    else if (activeTab === "moviesdoofree") setSeriesListMoviesDooFree(filterFn);
    else if (activeTab === "w3u") setSeriesListW3u(filterFn);

    if (selectedSeries && idsSet.has(selectedSeries.id)) {
      setSelectedSeries(null);
    }
  };

  const handleToggleSelectSeries = (id: string) => {
    setSelectedSeriesIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isAllSelected = useMemo(() => {
    if (filteredSeriesList.length === 0) return false;
    return filteredSeriesList.every((item) => selectedSeriesIds.includes(item.id));
  }, [filteredSeriesList, selectedSeriesIds]);

  const handleToggleSelectAll = () => {
    if (filteredSeriesList.length === 0) return;
    const filteredIds = filteredSeriesList.map((item) => item.id);
    if (isAllSelected) {
      setSelectedSeriesIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      const combined = new Set([...selectedSeriesIds, ...filteredIds]);
      setSelectedSeriesIds(Array.from(combined));
    }
  };

  const handleDeleteSelectedSeries = () => {
    if (selectedSeriesIds.length === 0) return;
    const count = selectedSeriesIds.length;
    deleteSeriesListByIds(selectedSeriesIds);
    addLog(`🗑️ ลบซีรีส์ที่เลือกจำนวน ${count} รายการ เรียบร้อยแล้ว`, "info");
    setSelectedSeriesIds([]);
  };

  const handleDeleteSingleSeries = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSeriesListByIds([id]);
    setSelectedSeriesIds((prev) => prev.filter((i) => i !== id));
    addLog(`🗑️ ลบซีรีส์ "${title}" เรียบร้อยแล้ว`, "info");
  };

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    const totalEpisodes = activeSeriesList.reduce((acc, current) => acc + current.episodes.length, 0);
    return {
      seriesCount: activeSeriesList.length,
      episodeCount: totalEpisodes
    };
  }, [activeSeriesList]);

  return (
    <div className="min-h-screen bg-[#0A0C10] flex flex-col text-gray-300 font-sans">
      {/* Sleek GitHub/Technical Header style */}
      <header className="border-b border-[#2D333B] bg-[#11141B] py-3.5 px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-0 z-40 backdrop-blur-md bg-opacity-95">
        <div className="flex items-center gap-3.5 w-full sm:w-auto">
          <div className="w-9 h-9 bg-[#58A6FF] text-[#0A0C10] rounded flex items-center justify-center font-black text-lg select-none">
            K
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-wider uppercase text-gray-100 font-mono" style={{ borderColor: "#4b6d55" }}>K-Harvest Pro</h1>
              <span className="text-[10px] bg-[#1f242c] border border-[#2D333B] px-1.5 py-0.5 rounded text-[#58A6FF] font-mono">BY PLAID</span>
            </div>
            <p className="text-[10px] text-[#58A6FF] uppercase tracking-wider font-mono">Multi-Page API Harvester v4.2</p>
          </div>
        </div>

        {/* Real-time status indicators in header */}
        <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto border-t sm:border-t-0 border-[#2D333B] pt-2 sm:pt-0">
          <div className="text-left sm:text-right font-mono">
            <div className="text-[10px] text-gray-500 uppercase">Proxy Connection</div>
            <div className="text-xs text-[#3FB950] font-medium flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#3FB950] animate-pulse" />
              <span>● STABLE / HTTPS</span>
            </div>
          </div>
          
          <div className="hidden md:block h-8 w-[1px] bg-[#2D333B]" />

          <div className="text-left sm:text-right font-mono">
            <div className="text-[10px] text-gray-500 uppercase">Active Engine</div>
            <div className="text-xs text-white uppercase mt-0.5 truncate max-w-[200px]">
              {activeTab === "okserietv" || activeTab === "kubhd24" ? "OKSERIETV SCRAPER" : activeTab === "123hdtv" ? "123HDTV AJAX" : activeTab === "ezmovie" ? "EZMOVIE SCRAPER" : activeTab === "wowdrama" ? "WOW-DRAMA SCRAPER" : activeTab === "seriedays" ? "SERIEDAYS SCRAPER" : activeTab === "24hd" ? "24HD MOVIES SCRAPER" : activeTab === "ddnung" ? "DDNUNG SCRAPER" : activeTab === "moviesdoofree" ? "MOVIESDOOFREE SCRAPER" : activeTab === "w3u" ? "W3U CONVERTER" : activeTab === "proxy" ? "REFERER PROXY SYSTEM" : "DOO-NANG GRAPHQL"}
            </div>
          </div>

          <div className="hidden sm:block h-8 w-[1px] bg-[#2D333B]" />

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-[#161B22] border border-[#2D333B] rounded text-[11px] text-amber-500 font-mono">
            <Clock size={11} className="text-amber-500" />
            <span>UTC 2026-05-26</span>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-7xl flex-1 flex flex-col">

      {/* Dynamic Tab Switcher */}
      <div className="flex bg-[#11141B] border border-[#2D333B] p-1.5 rounded-lg mb-6 w-full max-w-4xl mx-auto gap-2 overflow-x-auto">
        <button
          onClick={() => {
            if (!isHarvesting) {
              handleSwitchTab("okserietv");
            }
          }}
          disabled={isHarvesting}
          className={cn(
            "flex-1 py-2.5 px-3 rounded text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50 whitespace-nowrap",
            activeTab === "okserietv" || activeTab === "kubhd24" 
              ? "bg-[#58A6FF] text-[#0A0C10]" 
              : "text-gray-400 hover:text-white hover:bg-[#161B22]"
          )}
        >
          <Tv size={14} style={{ backgroundColor: "#f3e6e6" }} />
          <span style={{ backgroundColor: "#c71919", borderColor: "#050d1e", color: "#eaf3ff" }}>OKSERIETV</span>
        </button>

        <button
          onClick={() => {
            if (!isHarvesting) {
              handleSwitchTab("123hdtv");
            }
          }}
          disabled={isHarvesting}
          style={{ color: "#e6eef9" }}
          className={cn(
            "flex-1 py-2.5 px-3 rounded text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50 whitespace-nowrap",
            activeTab === "123hdtv" 
              ? "bg-[#58A6FF] text-[#0A0C10]" 
              : "text-gray-400 hover:text-white hover:bg-[#161B22]"
          )}
        >
          <Layers size={14} />
          <span style={{ backgroundColor: "#ff0000" }}>123HDTV</span>
        </button>

        <button
          onClick={() => {
            if (!isHarvesting) {
              handleSwitchTab("doonang");
            }
          }}
          disabled={isHarvesting}
          style={{ backgroundColor: "#000000" }}
          className={cn(
            "flex-1 py-2.5 px-3 rounded text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50 whitespace-nowrap",
            activeTab === "doonang" 
              ? "bg-[#58A6FF] text-[#0A0C10]" 
              : "text-gray-400 hover:text-white hover:bg-[#161B22]"
          )}
        >
          <Film size={14} />
          <span style={{ backgroundColor: "#ea0000", color: "#d6dbe5" }}>DOO-NANG</span>
        </button>

        <button
          onClick={() => {
            if (!isHarvesting) {
              handleSwitchTab("ezmovie");
            }
          }}
          disabled={isHarvesting}
          style={{ backgroundColor: "#13e400" }}
          className={cn(
            "flex-1 py-2.5 px-3 rounded text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50 whitespace-nowrap",
            activeTab === "ezmovie" 
              ? "bg-[#58A6FF] text-[#0A0C10]" 
              : "text-gray-400 hover:text-white hover:bg-[#161B22]"
          )}
        >
          <Play size={14} />
          <span style={{ backgroundColor: "#251f1f" }}>EZMOVIE</span>
        </button>

        <button
          onClick={() => {
            if (!isHarvesting) {
              handleSwitchTab("wowdrama");
            }
          }}
          disabled={isHarvesting}
          className={cn(
            "flex-1 py-2.5 px-3 rounded text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50 whitespace-nowrap",
            activeTab === "wowdrama" 
              ? "bg-[#58A6FF] text-[#0A0C10]" 
              : "text-gray-400 hover:text-white hover:bg-[#161B22]"
          )}
        >
          <Sparkles size={14} />
          <span>WOW-DRAMA</span>
        </button>

        <button
          onClick={() => {
            if (!isHarvesting) {
              handleSwitchTab("seriedays");
            }
          }}
          disabled={isHarvesting}
          className={cn(
            "flex-1 py-2.5 px-3 rounded text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50 whitespace-nowrap",
            activeTab === "seriedays" 
              ? "bg-[#58A6FF] text-[#0A0C10]" 
              : "text-gray-400 hover:text-white hover:bg-[#161B22]"
          )}
        >
          <Tv size={14} />
          <span>SERIEDAYS</span>
        </button>

        <button
          onClick={() => {
            if (!isHarvesting) {
              handleSwitchTab("24hd");
            }
          }}
          disabled={isHarvesting}
          className={cn(
            "flex-1 py-2.5 px-3 rounded text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50 whitespace-nowrap",
            activeTab === "24hd" 
              ? "bg-[#58A6FF] text-[#0A0C10]" 
              : "text-gray-400 hover:text-white hover:bg-[#161B22]"
          )}
        >
          <Film size={14} />
          <span>24HD MOVIES</span>
        </button>

        <button
          onClick={() => {
            if (!isHarvesting) {
              handleSwitchTab("ddnung");
            }
          }}
          disabled={isHarvesting}
          className={cn(
            "flex-1 py-2.5 px-3 rounded text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50 whitespace-nowrap",
            activeTab === "ddnung" 
              ? "bg-[#58A6FF] text-[#0A0C10]" 
              : "text-gray-400 hover:text-white hover:bg-[#161B22]"
          )}
        >
          <Film size={14} />
          <span>DDNUNG (ดีดีหนัง)</span>
        </button>

        <button
          onClick={() => {
            if (!isHarvesting) {
              handleSwitchTab("moviesdoofree");
            }
          }}
          disabled={isHarvesting}
          className={cn(
            "flex-1 py-2.5 px-3 rounded text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50 whitespace-nowrap",
            activeTab === "moviesdoofree" 
              ? "bg-[#58A6FF] text-[#0A0C10]" 
              : "text-gray-400 hover:text-white hover:bg-[#161B22]"
          )}
        >
          <Film size={14} />
          <span>MOVIESDOOFREE</span>
        </button>

        <button
          onClick={() => {
            if (!isHarvesting) {
              handleSwitchTab("w3u");
            }
          }}
          disabled={isHarvesting}
          className={cn(
            "flex-1 py-2.5 px-3 rounded text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50 whitespace-nowrap",
            activeTab === "w3u" 
              ? "bg-[#58A6FF] text-[#0A0C10]" 
              : "text-gray-400 hover:text-white hover:bg-[#161B22]"
          )}
        >
          <Plus size={14} />
          <span>W3U</span>
        </button>

        <button
          onClick={() => {
            if (!isHarvesting) {
              handleSwitchTab("proxy");
            }
          }}
          disabled={isHarvesting}
          className={cn(
            "flex-1 py-2.5 px-3 rounded text-xs font-bold font-mono tracking-wider uppercase transition-all flex items-center justify-center gap-2 select-none cursor-pointer disabled:opacity-50 whitespace-nowrap",
            activeTab === "proxy" 
              ? "bg-[#3FB950] text-[#0A0C10]" 
              : "text-gray-400 hover:text-white hover:bg-[#161B22]"
          )}
        >
          <Globe size={14} />
          <span>PROXY SYSTEM</span>
        </button>
      </div>

      {/* Grid of central components */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mb-8" style={{ backgroundColor: "#000000" }}>
        
        {/* LEFT COLUMN: Controls & Settings Panel - spanning 5 grid slots */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-[#11141B] border border-[#2D333B] rounded">
            <div className="p-4 border-b border-[#2D333B] flex items-center justify-between bg-[#161B22]">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#58A6FF] animate-pulse" />
                <h2 className="text-xs font-bold tracking-wider uppercase text-gray-200 font-mono">
                  {activeTab === "okserietv" || activeTab === "kubhd24" ? "OKSerieTV Config" : activeTab === "123hdtv" ? "123HDTV Config Parameters" : activeTab === "ezmovie" ? "EzMovie Config" : activeTab === "wowdrama" ? "WOW-Drama Config" : activeTab === "w3u" ? "W3U Converter Config" : "Doo-Nang Config"}
                </h2>
              </div>
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 hover:bg-[#202530] text-gray-400 hover:text-[#58A6FF] rounded transition-colors cursor-pointer"
                title="ตั้งค่าขั้นสูง"
              >
                <Settings size={16} className={cn(showSettings && "text-[#58A6FF] rotate-45", "transition-all duration-300")} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4" style={{ backgroundColor: "#000000" }}>
              {/* KUBHD24 Configuration Forms */}
              {activeTab === "kubhd24" && (
                <>
                  {/* Category selector */}
                  <div className="flex flex-col gap-1.5 pb-2 border-b border-[#2D333B]/60">
                    <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Target Category Node</label>
                    <div className="flex flex-col gap-2">
                      <select
                        disabled={isHarvesting}
                        value={categoryType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCategoryType(val);
                          if (val !== "custom") {
                            setCategoryUrl(val);
                          }
                        }}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-2 text-[#58A6FF] text-xs font-mono focus:outline-none focus:border-[#58A6FF] bg-opacity-50"
                      >
                        <option value="https://kubhd24.net/category/watch-series/">📺 ซีรีย์หลักทั้งหมด (Watch Series)</option>
                        <option value="https://kubhd24.net/category/thai-dubbed-series/">🇹🇭 ซีรีย์พากย์ไทย (Thai Dubbed-Series)</option>
                        <option value="https://kubhd24.net/category/thai-series/">🍜 ซีรีย์ไทย (Thai-Series)</option>
                        <option value="custom">✏️ กำหนดคีย์ / URL หมวดหมู่อื่นๆ (Custom Category URL)</option>
                      </select>

                      {categoryType === "custom" && (
                        <input
                          type="url"
                          disabled={isHarvesting}
                          value={categoryUrl}
                          onChange={(e) => setCategoryUrl(e.target.value)}
                          placeholder="https://kubhd24.net/category/..."
                          className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#58A6FF] font-mono"
                        />
                      )}
                    </div>
                  </div>

                  {/* Settings parameters */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Start Page (1-73)</label>
                      <input
                        type="number"
                        min="1"
                        max="73"
                        disabled={isHarvesting}
                        value={startPage}
                        onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#58A6FF] font-mono disabled:opacity-50"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">End Page</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        disabled={isHarvesting}
                        value={endPage}
                        onChange={(e) => setEndPage(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-[#58A6FF] font-mono disabled:opacity-50"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 123HDTV Configuration Forms */}
              {activeTab === "123hdtv" && (
                <div className="flex flex-col gap-3 pt-1">
                  {/* Mode Selector Option */}
                  <div className="flex flex-col gap-1.5 pb-2 border-b border-[#2D333B]/60 font-mono">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">โหมดการขุดข้อมูล (Harvester Mode)</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setScrapperMode123("category")}
                        disabled={isHarvesting}
                        className={cn(
                          "flex-1 py-1.5 rounded text-[11px] font-bold uppercase border transition-all text-center cursor-pointer",
                          scrapperMode123 === "category"
                            ? "bg-[#58A6FF]/10 border-[#58A6FF] text-[#58A6FF]"
                            : "bg-[#161B22] border-[#2D333B] text-gray-400 hover:text-white"
                        )}
                      >
                        📂 หมวดหมู่อัตโนมัติ (Auto)
                      </button>
                      <button
                        type="button"
                        onClick={() => setScrapperMode123("single_post")}
                        disabled={isHarvesting}
                        className={cn(
                          "flex-1 py-1.5 rounded text-[11px] font-bold uppercase border transition-all text-center cursor-pointer",
                          scrapperMode123 === "single_post"
                            ? "bg-[#58A6FF]/10 border-[#58A6FF] text-[#58A6FF]"
                            : "bg-[#161B22] border-[#2D333B] text-gray-400 hover:text-white"
                        )}
                      >
                        📺 เจาะเจาะรายเรื่อง (Single)
                      </button>
                    </div>
                  </div>

                  {scrapperMode123 === "category" ? (
                    <>
                      {/* Category list presets */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">หมวดหมู่เป้าหมาย (Category Preset)</label>
                        <select
                          disabled={isHarvesting}
                          value={categoryType123}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCategoryType123(val);
                            if (val !== "custom") {
                              setCategoryUrl123(val);
                            }
                          }}
                          className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-[#58A6FF] text-xs font-mono focus:outline-none focus:border-[#58A6FF] bg-opacity-50 font-semibold cursor-pointer"
                        >
                          <option value="https://www.123-hdx.com/%e0%b8%ab%e0%b8%99%e0%b8%b1%e0%b8%87%e0%b9%83%e0%b8%ab%e0%b8%a1%e0%b9%88-2026">🎬 หนังใหม่ 2026 (123-hdx.com - ตามสคริปต์ Python)</option>
                          <option value="https://www.123-hdx.com/หนังใหม่-2025">🎬 หนังใหม่ 2025 (123-hdx.com)</option>
                          <option value="https://www.123-hdx.com/ดูหนังออนไลน์/หนังไทย">🇹🇭 หนังไทย (123-hdx.com)</option>
                          <option value="https://www.123-hdx.com/ดูหนังออนไลน์/ซีรี่ย์ไทย">🇹🇭 ซีรี่ย์ไทย (123-hdx.com)</option>
                          <option value="https://www.123-hdx.com/ดูหนังออนไลน์/หนังจีน">🇨🇳 หนังจีน (123-hdx.com)</option>
                          <option value="https://www.123-hdx.com/ดูหนังออนไลน์/ซีรี่ย์จีน">🇨🇳 ซีรี่ย์จีน (123-hdx.com)</option>
                          <option value="https://www.123-hdx.com/ดูหนังออนไลน์/หนังฝรั่ง">🇺🇸 หนังฝรั่ง (123-hdx.com)</option>
                          <option value="https://www.123-hdx.com/ดูหนังออนไลน์/ซีรี่ย์ฝรั่ง">🇺🇸 ซีรี่ย์ฝรั่ง (123-hdx.com)</option>
                          <option value="https://www.123-hdx.com/ดูหนังออนไลน์/ซีรี่ย์เกาหลี">🇰🇷 ซีรี่ย์เกาหลี (123-hdx.com)</option>
                          <option value="https://www.123hdtv.com/ดูหนังออนไลน์/หนังไทย">🇹🇭 หนังไทย (123hdtv.com)</option>
                          <option value="https://www.123hdtv.com/ดูหนังออนไลน์/ซีรี่ย์ไทย">🇹🇭 ซีรี่ย์ไทย (123hdtv.com)</option>
                          <option value="custom">✏️ กำหนด URL เอง (Custom URL)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">URL หมวดหมู่ (123-HD Target URL)</label>
                        <input
                          type="text"
                          disabled={isHarvesting}
                          value={categoryUrl123}
                          onChange={(e) => {
                            setCategoryUrl123(e.target.value);
                            setCategoryType123("custom");
                          }}
                          placeholder="เช่น https://www.123-hdx.com/หนังใหม่-2026"
                          className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                        />
                      </div>

                      {/* Pagination scope */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">หน้าเริ่มต้น (Start Page)</label>
                          <input
                            type="number"
                            min="1"
                            disabled={isHarvesting}
                            value={startPage123}
                            onChange={(e) => setStartPage123(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">หน้าสิ้นสุด (End Page)</label>
                          <input
                            type="number"
                            min="1"
                            disabled={isHarvesting}
                            value={endPage123}
                            onChange={(e) => setEndPage123(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                          />
                        </div>
                      </div>

                      {/* Python Mode Options: Separate Movie/Series */}
                      <div className="flex items-center justify-between p-2 bg-[#161B22] border border-[#2D333B] rounded">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-mono text-gray-200">แยกไฟล์ Movie กับ Series (M_S = 1)</span>
                          <span className="text-[9px] text-gray-400">แยกกลุ่มตามโครงสร้างสคริปต์ Python อัตโนมัติ</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={separateMoviesAndSeries123}
                          onChange={(e) => setSeparateMoviesAndSeries123(e.target.checked)}
                          disabled={isHarvesting}
                          className="w-4 h-4 accent-[#58A6FF] rounded cursor-pointer"
                        />
                      </div>

                      {/* Download / Export W3U & M3U for 123HD */}
                      {(generatedM3U123 || generatedW3U123 || seriesList123.length > 0) && (
                        <div className="flex flex-col gap-2 p-2.5 bg-[#161B22]/80 border border-[#58A6FF]/30 rounded font-mono">
                          <span className="text-[10px] text-[#58A6FF] font-bold uppercase tracking-wider flex items-center gap-1">
                            <span>📦</span> ไฟล์ผลลัพธ์ 123HDTV พร้อมใช้งาน
                          </span>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const content = generatedM3U123 || generateMergedM3U();
                                downloadM3U(content, generatedM3U123Name);
                                addLog(`💾 ดาวน์โหลดไฟล์ ${generatedM3U123Name} เรียบร้อยแล้ว`, "success");
                              }}
                              className="py-1.5 px-2 bg-[#3FB950]/15 hover:bg-[#3FB950]/25 text-[#3FB950] border border-[#3FB950]/40 rounded text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Download size={12} />
                              <span>โหลด .M3U</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const content = generatedW3U123 || JSON.stringify(seriesList123, null, 2);
                                const blob = new Blob([content], { type: "application/json" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = generatedW3U123Name;
                                a.click();
                                URL.revokeObjectURL(url);
                                addLog(`💾 ดาวน์โหลดไฟล์ ${generatedW3U123Name} เรียบร้อยแล้ว`, "success");
                              }}
                              className="py-1.5 px-2 bg-[#58A6FF]/15 hover:bg-[#58A6FF]/25 text-[#58A6FF] border border-[#58A6FF]/40 rounded text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Download size={12} />
                              <span>โหลด .W3U</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const content = generatedM3U123 || generateMergedM3U();
                                copyToClipboard(content, "123-m3u-all");
                                addLog(`📋 คัดลอก M3U ของ 123HDTV แล้ว!`, "success");
                              }}
                              className="py-1 px-2 bg-[#21262D] hover:bg-[#30363D] text-gray-200 border border-[#30363D] rounded text-[9px] flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Copy size={10} />
                              <span>คัดลอก M3U</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const content = generatedW3U123 || JSON.stringify(seriesList123, null, 2);
                                copyToClipboard(content, "123-w3u-all");
                                addLog(`📋 คัดลอก W3U (JSON) ของ 123HDTV แล้ว!`, "success");
                              }}
                              className="py-1 px-2 bg-[#21262D] hover:bg-[#30363D] text-gray-200 border border-[#30363D] rounded text-[9px] flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Copy size={10} />
                              <span>คัดลอก W3U</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Post ID</label>
                          <input
                            type="number"
                            min="1"
                            disabled={isHarvesting}
                            value={postId123}
                            onChange={(e) => setPostId123(parseInt(e.target.value) || 0)}
                            className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Nonce Key</label>
                          <input
                            type="text"
                            disabled={isHarvesting}
                            value={nonce123}
                            onChange={(e) => setNonce123(e.target.value)}
                            className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Episodes Count</label>
                          <input
                            type="number"
                            min="1"
                            disabled={isHarvesting}
                            value={totalEpisodes123}
                            onChange={(e) => setTotalEpisodes123(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Slug / Link ID</label>
                          <input
                            type="text"
                            disabled={isHarvesting}
                            value={slug123}
                            onChange={(e) => setSlug123(e.target.value)}
                            className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Series Title (แสดงผล)</label>
                        <input
                          type="text"
                          disabled={isHarvesting}
                          value={title123}
                          onChange={(e) => setTitle123(e.target.value)}
                          className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#58A6FF]"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Poster Image Address</label>
                        <input
                          type="text"
                          disabled={isHarvesting}
                          value={poster123}
                          onChange={(e) => setPoster123(e.target.value)}
                          className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Synopsis Description</label>
                        <textarea
                          disabled={isHarvesting}
                          value={synopsis123}
                          onChange={(e) => setSynopsis123(e.target.value)}
                          rows={2}
                          className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs resize-none focus:outline-none focus:border-[#58A6FF]"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* DOO-NANG Configuration Forms */}
              {activeTab === "doonang" && (
                <div className="flex flex-col gap-4 pt-1">
                  {/* Mode Selector */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-[#0D1117] p-1 rounded border border-[#2D333B]">
                    <button
                      type="button"
                      onClick={() => setDoonangFetchMode("movie_id")}
                      className={cn(
                        "py-1.5 px-2 rounded text-xs font-mono font-medium transition-all cursor-pointer flex items-center justify-center gap-1",
                        doonangFetchMode === "movie_id"
                          ? "bg-[#58A6FF] text-[#0D1117] font-bold shadow-sm"
                          : "text-gray-400 hover:text-white"
                      )}
                    >
                      <Film size={13} />
                      <span>🎬 Movie ID</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDoonangFetchMode("tag")}
                      className={cn(
                        "py-1.5 px-2 rounded text-xs font-mono font-medium transition-all cursor-pointer flex items-center justify-center gap-1",
                        doonangFetchMode === "tag"
                          ? "bg-[#58A6FF] text-[#0D1117] font-bold shadow-sm"
                          : "text-gray-400 hover:text-white"
                      )}
                    >
                      <Globe size={13} />
                      <span>🏷️ Tag / หมวดหมู่</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDoonangFetchMode("show_id")}
                      className={cn(
                        "py-1.5 px-2 rounded text-xs font-mono font-medium transition-all cursor-pointer flex items-center justify-center gap-1",
                        doonangFetchMode === "show_id"
                          ? "bg-[#58A6FF] text-[#0D1117] font-bold shadow-sm"
                          : "text-gray-400 hover:text-white"
                      )}
                    >
                      <Layers size={13} />
                      <span>📺 Show ID</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDoonangFetchMode("category")}
                      className={cn(
                        "py-1.5 px-2 rounded text-xs font-mono font-medium transition-all cursor-pointer flex items-center justify-center gap-1",
                        doonangFetchMode === "category"
                          ? "bg-[#58A6FF] text-[#0D1117] font-bold shadow-sm"
                          : "text-gray-400 hover:text-white"
                      )}
                    >
                      <Sparkles size={13} />
                      <span>📚 หมวด Netflix</span>
                    </button>
                  </div>

                  {/* Panel 1: Movie ID */}
                  {doonangFetchMode === "movie_id" && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="movieId" className="text-[10px] text-gray-400 font-mono uppercase tracking-wider flex items-center justify-between">
                          <span>Movie ID (เลขไอดีภาพยนตร์ Doo-Nang)</span>
                          <span className="text-[#58A6FF] normal-case">เช่น 1234, 5678, 8910</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="movieId"
                            type="number"
                            disabled={isHarvesting}
                            value={doonangMovieId}
                            onChange={(e) => setDoonangMovieId(e.target.value)}
                            placeholder="ใส่ Movie ID เช่น 1234"
                            className="flex-1 bg-[#161B22] border border-[#2D333B] rounded px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                          />
                          <button
                            id="fetchMovieBtn"
                            type="button"
                            disabled={isHarvesting || !doonangMovieId}
                            onClick={() => fetchMovieByIdDoonang(doonangMovieId)}
                            className="px-4 py-2 bg-[#58A6FF] hover:bg-blue-400 text-[#0D1117] font-bold font-mono text-xs uppercase rounded transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Play size={13} fill="currentColor" />
                            <span>ดึงข้อมูล</span>
                          </button>
                        </div>
                      </div>

                      {/* Loader Indicator */}
                      {isHarvesting && (
                        <div id="loader" className="p-3 bg-[#161B22] border border-[#2D333B] rounded text-xs text-[#58A6FF] font-mono animate-pulse flex items-center gap-2">
                          <span>⏳ กำลังประมวลผลข้อมูลหนัง ดึง Subtitle และ Audio Tracks...</span>
                        </div>
                      )}

                      {/* Result Area */}
                      {(doonangResultM3U || doonangResultJSON) && (
                        <div id="resultAreaMovie" className="flex flex-col gap-3 border-t border-[#2D333B] pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle size={14} /> ผลลัพธ์ข้อมูลภาพยนตร์ (M3U & JSON Data)
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(doonangResultM3U);
                                  addLog("📋 คัดลอก M3U Playlist เรียบร้อยแล้ว", "success");
                                }}
                                className="px-2.5 py-1 bg-[#21262D] hover:bg-[#30363D] text-gray-200 text-[11px] font-mono rounded border border-[#30363D] flex items-center gap-1 cursor-pointer"
                              >
                                <Copy size={11} /> คัดลอก M3U
                              </button>
                              <button
                                id="downloadMovieM3uBtn"
                                type="button"
                                onClick={() => {
                                  downloadM3U(doonangResultM3U, `doonang_movie_${doonangMovieId}.m3u`);
                                }}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-mono font-bold rounded flex items-center gap-1 cursor-pointer"
                              >
                                <Download size={11} /> 📥 ดาวน์โหลด .m3u
                              </button>
                            </div>
                          </div>

                          {/* M3U Output */}
                          <div className="flex flex-col gap-1">
                            <h3 className="section-title text-[11px] text-gray-400 font-mono font-bold uppercase tracking-wider">M3U Playlist Content</h3>
                            <pre id="m3uOutputMovie" className="p-3 bg-[#0D1117] border border-[#2D333B] rounded text-[10px] font-mono text-[#58A6FF] max-h-48 overflow-y-auto whitespace-pre-wrap break-all selection:bg-[#58A6FF] selection:text-[#0D1117]">
                              {doonangResultM3U}
                            </pre>
                          </div>

                          {/* JSON Output */}
                          <div className="flex flex-col gap-1">
                            <h3 className="section-title text-[11px] text-gray-400 font-mono font-bold uppercase tracking-wider">JSON Raw Data</h3>
                            <pre id="jsonOutputMovie" className="p-3 bg-[#0D1117] border border-[#2D333B] rounded text-[10px] font-mono text-emerald-300 max-h-48 overflow-y-auto whitespace-pre-wrap break-all selection:bg-emerald-400 selection:text-[#0D1117]">
                              {doonangResultJSON}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Panel 2: Tag / Nation / URL */}
                  {doonangFetchMode === "tag" && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="tagValue" className="text-[10px] text-gray-400 font-mono uppercase tracking-wider flex items-center justify-between">
                          <span>Tag / ประเทศ / ลิงก์ URL (ดึงหนังสูงสุด 300 เรื่อง)</span>
                          <span className="text-[#58A6FF] normal-case">เช่น japan, เกาหลี, TH หรือวาง URL</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="tagValue"
                            type="text"
                            disabled={isHarvesting}
                            value={doonangTagValue}
                            onChange={(e) => setDoonangTagValue(e.target.value)}
                            placeholder="ใส่ประเทศ/Tag หรือวาง URL (เช่น japan, เกาหลี, TH หรือวาง URL)"
                            className="flex-1 bg-[#161B22] border border-[#2D333B] rounded px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                          />
                          <button
                            id="fetchTagBtn"
                            type="button"
                            disabled={isHarvesting || !doonangTagValue.trim()}
                            onClick={() => fetchMoviesByTagDoonang(doonangTagValue)}
                            className="px-4 py-2 bg-[#58A6FF] hover:bg-blue-400 text-[#0D1117] font-bold font-mono text-xs uppercase rounded transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Play size={13} fill="currentColor" />
                            <span>ดึงข้อมูลหมวดหมู่</span>
                          </button>
                        </div>
                      </div>

                      {/* Quick Tag Presets */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-gray-400 font-mono font-bold">แท็กแนะนำ:</span>
                        {[
                          { label: "🇯🇵 ญี่ปุ่น (japan)", value: "japan" },
                          { label: "🇰🇷 เกาหลี (เกาหลี)", value: "เกาหลี" },
                          { label: "🇹🇭 ไทย (TH)", value: "ไทย" },
                          { label: "🇨🇳 จีน (china)", value: "china" },
                          { label: "🇺🇸 สหรัฐฯ (US)", value: "usa" },
                          { label: "🇬🇧 อังกฤษ (UK)", value: "uk" },
                          { label: "🇭🇰 ฮ่องกง (HK)", value: "hongkong" },
                          { label: "🇫🇷 ฝรั่งเศส (FR)", value: "france" }
                        ].map((preset) => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => {
                              setDoonangTagValue(preset.value);
                              fetchMoviesByTagDoonang(preset.value);
                            }}
                            className="text-[10px] font-mono px-2 py-0.5 bg-[#161B22] hover:bg-[#222730] border border-[#2D333B] text-gray-300 hover:text-white rounded transition-colors cursor-pointer"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      {/* Loader Indicator */}
                      {isHarvesting && (
                        <div id="loaderTag" className="p-3 bg-[#161B22] border border-[#2D333B] rounded text-xs text-[#58A6FF] font-mono animate-pulse flex items-center gap-2">
                          <span>⏳ กำลังสืบค้นและประมวลผลข้อมูลหนังในหมวดหมู่ {doonangTagValue}...</span>
                        </div>
                      )}

                      {/* Result Area */}
                      {(doonangResultM3U || doonangResultJSON) && (
                        <div id="resultAreaTag" className="flex flex-col gap-3 border-t border-[#2D333B] pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle size={14} /> ผลลัพธ์หมวดหมู่ (M3U Playlist & JSON Data)
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(doonangResultM3U);
                                  addLog("📋 คัดลอก M3U Playlist เรียบร้อยแล้ว", "success");
                                }}
                                className="px-2.5 py-1 bg-[#21262D] hover:bg-[#30363D] text-gray-200 text-[11px] font-mono rounded border border-[#30363D] flex items-center gap-1 cursor-pointer"
                              >
                                <Copy size={11} /> คัดลอก M3U
                              </button>
                              <button
                                id="downloadTagM3uBtn"
                                type="button"
                                onClick={() => {
                                  downloadM3U(doonangResultM3U, `Category_${doonangTagValue.replace(/\s+/g, '_')}.m3u`);
                                }}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-mono font-bold rounded flex items-center gap-1 cursor-pointer"
                              >
                                <Download size={11} /> 📥 ดาวน์โหลดไฟล์ .m3u
                              </button>
                            </div>
                          </div>

                          {/* M3U Output */}
                          <div className="flex flex-col gap-1">
                            <h3 className="section-title text-[11px] text-gray-400 font-mono font-bold uppercase tracking-wider">M3U Playlist Content</h3>
                            <pre id="m3uOutputTag" className="p-3 bg-[#0D1117] border border-[#2D333B] rounded text-[10px] font-mono text-[#58A6FF] max-h-48 overflow-y-auto whitespace-pre-wrap break-all selection:bg-[#58A6FF] selection:text-[#0D1117]">
                              {doonangResultM3U}
                            </pre>
                          </div>

                          {/* JSON Output */}
                          <div className="flex flex-col gap-1">
                            <h3 className="section-title text-[11px] text-gray-400 font-mono font-bold uppercase tracking-wider">JSON Raw Data</h3>
                            <pre id="jsonOutputTag" className="p-3 bg-[#0D1117] border border-[#2D333B] rounded text-[10px] font-mono text-emerald-300 max-h-48 overflow-y-auto whitespace-pre-wrap break-all selection:bg-emerald-400 selection:text-[#0D1117]">
                              {doonangResultJSON}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {doonangFetchMode === "show_id" ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="showId" className="text-[10px] text-gray-400 font-mono uppercase tracking-wider flex items-center justify-between">
                          <span>Show ID (เลขไอดีซีรีส์ Doo-Nang)</span>
                          <span className="text-[#58A6FF] normal-case">เช่น 1234, 5678, 9012</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="showId"
                            type="number"
                            disabled={isHarvesting}
                            value={doonangShowId}
                            onChange={(e) => setDoonangShowId(e.target.value)}
                            placeholder="ใส่ Show ID (เช่น 1234)"
                            className="flex-1 bg-[#161B22] border border-[#2D333B] rounded px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                          />
                          <button
                            id="fetchBtn"
                            type="button"
                            disabled={isHarvesting || !doonangShowId}
                            onClick={() => fetchSeriesByIdDoonang(doonangShowId)}
                            className="px-4 py-2 bg-[#58A6FF] hover:bg-blue-400 text-[#0D1117] font-bold font-mono text-xs uppercase rounded transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Play size={13} fill="currentColor" />
                            <span>ดึงข้อมูลและสร้าง M3U</span>
                          </button>
                        </div>
                      </div>

                      {/* Loader Indicator */}
                      {isHarvesting && (
                        <div id="loader" className="p-3 bg-[#161B22] border border-[#2D333B] rounded text-xs text-[#58A6FF] font-mono animate-pulse flex items-center gap-2">
                          <span>⏳ กำลังประมวลผลข้อมูล ดึงซีซัน Subtitle และ Audio Tracks...</span>
                        </div>
                      )}

                      {/* Result Area */}
                      {(doonangResultM3U || doonangResultJSON) && (
                        <div id="resultArea" className="flex flex-col gap-3 border-t border-[#2D333B] pt-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle size={14} /> ผลลัพธ์ข้อมูลเพลย์ลิสต์ (M3U & JSON Data)
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(doonangResultM3U);
                                  addLog("📋 คัดลอก M3U Playlist เรียบร้อยแล้ว", "success");
                                }}
                                className="px-2.5 py-1 bg-[#21262D] hover:bg-[#30363D] text-gray-200 text-[11px] font-mono rounded border border-[#30363D] flex items-center gap-1 cursor-pointer"
                              >
                                <Copy size={11} /> คัดลอก M3U
                              </button>
                              <button
                                id="downloadBtn"
                                type="button"
                                onClick={() => {
                                  downloadM3U(doonangResultM3U, `doonang_series_${doonangShowId}.m3u`);
                                }}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-mono font-bold rounded flex items-center gap-1 cursor-pointer"
                              >
                                <Download size={11} /> 📥 ดาวน์โหลดไฟล์ .m3u
                              </button>
                            </div>
                          </div>

                          {/* M3U Output */}
                          <div className="flex flex-col gap-1">
                            <h3 className="section-title text-[11px] text-gray-400 font-mono font-bold uppercase tracking-wider">M3U Playlist Content</h3>
                            <pre id="m3uOutput" className="p-3 bg-[#0D1117] border border-[#2D333B] rounded text-[10px] font-mono text-[#58A6FF] max-h-48 overflow-y-auto whitespace-pre-wrap break-all selection:bg-[#58A6FF] selection:text-[#0D1117]">
                              {doonangResultM3U}
                            </pre>
                          </div>

                          {/* JSON Output */}
                          <div className="flex flex-col gap-1">
                            <h3 className="section-title text-[11px] text-gray-400 font-mono font-bold uppercase tracking-wider">JSON Raw Data</h3>
                            <pre id="jsonOutput" className="p-3 bg-[#0D1117] border border-[#2D333B] rounded text-[10px] font-mono text-emerald-300 max-h-48 overflow-y-auto whitespace-pre-wrap break-all selection:bg-emerald-400 selection:text-[#0D1117]">
                              {doonangResultJSON}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Target Page No.</label>
                          <input
                            type="number"
                            min="1"
                            disabled={isHarvesting}
                            value={pageDoonang}
                            onChange={(e) => setPageDoonang(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Limit (Max Count)</label>
                          <input
                            type="number"
                            min="1"
                            disabled={isHarvesting}
                            value={limitDoonang}
                            onChange={(e) => setLimitDoonang(Math.max(1, parseInt(e.target.value) || 24))}
                            className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                          />
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-500 bg-[#0d1117] p-3 rounded border border-[#2D333B] font-mono leading-relaxed">
                        🌟 โหลดคลังวิดีโอหมวดหมู่ Netflix (serie-tag) ล่าสุดจากเซิร์ฟเวอร์แบบ GraphQL และทำการจัดเตรียมลิสต์ .m3u8 เพลย์ลิสต์ให้อย่างรวดเร็ว
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* EZMOVIE Configuration Forms */}
              {activeTab === "ezmovie" && (
                <div className="flex flex-col gap-3 pt-1">
                  {/* Category selector */}
                  <div className="flex flex-col gap-1.5 pb-2 border-b border-[#2D333B]/60">
                    <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Target Category Node</label>
                    <div className="flex flex-col gap-2">
                      <select
                        disabled={isHarvesting}
                        value={ezCategoryType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEzCategoryType(val);
                          if (val !== "custom") {
                            setEzCategory(val);
                          }
                        }}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-[#58A6FF] text-xs font-mono focus:outline-none focus:border-[#58A6FF] bg-opacity-50 font-semibold"
                      >
                        <option value="/movies/หนังมาใหม่">🎬 หนังมาใหม่ทั้งหมด (New Movies)</option>
                        <option value="/movies/หนังไทย">🇹🇭 หนังไทย (Thai Movies)</option>
                        <option value="/movies/หนังฝรั่ง">🇺🇸 หนังฝรั่ง (Western Movies)</option>
                        <option value="/movies/หนังเอเชีย">🇨🇳 หนังเอเชีย (Asian Movies)</option>
                        <option value="/movies/หนังแอคชั่นบู๊-action">💥 หนังบู๊แอคชั่น (Action)</option>
                        <option value="/movies/หนังดราม่า-drama">😭 หนังดราม่าชีวิต (Drama)</option>
                        <option value="/movies/หนังผจญภัย-adventure">🗺️ หนังผจญภัย (Adventure)</option>
                        <option value="/movies/หนังเกาหลี">🇰🇷 หนังเกาหลี (Korean Movies)</option>
                        <option value="/movies/หนังญี่ปุ่น">🇯🇵 หนังญี่ปุ่น (Japanese Movies)</option>
                        <option value="custom">✏️ กำหนดคีย์ / URL หมวดหมู่อื่นๆ (Custom URL / Path)</option>
                      </select>

                      {ezCategoryType === "custom" && (
                        <input
                          type="text"
                          disabled={isHarvesting}
                          value={ezCategory}
                          onChange={(e) => setEzCategory(e.target.value)}
                          placeholder="เช่น https://ezmovie.movie/movies/... หรือ /movies/..."
                          className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#58A6FF] font-mono"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Start Page</label>
                      <input
                        type="number"
                        min="1"
                        disabled={isHarvesting}
                        value={ezStartPage}
                        onChange={(e) => setEzStartPage(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">End Page</label>
                      <input
                        type="number"
                        min="1"
                        disabled={isHarvesting}
                        value={ezEndPage}
                        onChange={(e) => setEzEndPage(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                  </div>

                  <span className="text-[10px] text-[#58A6FF]/90 bg-[#58A6FF]/5 p-3 rounded border border-[#58A6FF]/10 font-mono leading-relaxed">
                    🌟 ดึงข้อมูลจากคลังภาพยนตร์ ezmovie.movie โดยอัตโนมัติ ด้วยระบบระบุ iframe แปลงไฟล์ M3U8 เพลย์ลิสต์ตรงระดับพรีเมี่ยม
                  </span>
                </div>
              )}

              {/* WOW-DRAMA Configuration Forms */}
              {activeTab === "wowdrama" && (
                <div className="flex flex-col gap-3 pt-1">
                  <div className="flex flex-col gap-1.5 pb-2 border-b border-[#2D333B]/60">
                    <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Target Category (WOW-Drama)</label>
                    <div className="flex flex-col gap-2">
                      <select
                        disabled={isHarvesting}
                        value={categoryUrlWow}
                        onChange={(e) => {
                          setCategoryUrlWow(e.target.value);
                        }}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-[#58A6FF] text-xs font-mono focus:outline-none focus:border-[#58A6FF] bg-opacity-50 font-semibold"
                      >
                        <option value="https://wow-drama.com/category/the-series-th/">🇹🇭 ซีรีส์ไทย (the-series-th)</option>
                        <option value="https://wow-drama.com/category/korea-series/">🇰🇷 ซีรีส์เกาหลี (korea-series)</option>
                        <option value="https://wow-drama.com/category/japan-series/">🇯🇵 ซีรีส์ญี่ปุ่น (japan-series)</option>
                        <option value="https://wow-drama.com/category/china-series/">🇨🇳 ซีรีส์จีน (china-series)</option>
                        <option value="https://wow-drama.com/category/inter-series/">🇺🇸 ซีรีส์ฝรั่ง (inter-series)</option>
                      </select>
                      <input
                        type="text"
                        disabled={isHarvesting}
                        value={categoryUrlWow}
                        onChange={(e) => setCategoryUrlWow(e.target.value)}
                        placeholder="หรือระบุ URL หมวดหมู่ตรงๆ"
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Start Page</label>
                      <input
                        type="number"
                        min="1"
                        disabled={isHarvesting}
                        value={startPageWow}
                        onChange={(e) => setStartPageWow(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">End Page</label>
                      <input
                        type="number"
                        min="1"
                        disabled={isHarvesting}
                        value={endPageWow}
                        onChange={(e) => setEndPageWow(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="skipUnfinished"
                      type="checkbox"
                      disabled={isHarvesting}
                      checked={skipUnfinishedWow}
                      onChange={(e) => setSkipUnfinishedWow(e.target.checked)}
                      className="rounded bg-[#161B22] border-[#2D333B] text-[#58A6FF] focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="skipUnfinished" className="text-xs text-gray-300 font-mono cursor-pointer select-none">
                      ข้ามเรื่องที่ยังไม่จบ (pstatus == &quot;ยังไม่จบ&quot;)
                    </label>
                  </div>

                  <span className="text-[10px] text-gray-500 bg-[#0d1117] p-3 rounded border border-[#2D333B] font-mono leading-relaxed">
                    🎬 ดึงซีรีส์จาก wow-drama.com พร้อมถอดรหัสเซิร์ฟเวอร์เล่นวิดีโอ ok-hd.com และจัดเก็บเป็น W3U / M3U เพลย์ลิสต์อัตโนมัติ
                  </span>
                </div>
              )}

              {/* SERIEDAYS Configuration Forms */}
              {activeTab === "seriedays" && (
                <div className="flex flex-col gap-3 pt-1">
                  <div className="flex flex-col gap-1.5 pb-2 border-b border-[#2D333B]/60">
                    <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Target Category (SerieDays)</label>
                    <div className="flex flex-col gap-2">
                      <select
                        disabled={isHarvesting}
                        value={categoryUrlSerieDays}
                        onChange={(e) => {
                          setCategoryUrlSerieDays(e.target.value);
                        }}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-[#58A6FF] text-xs font-mono focus:outline-none focus:border-[#58A6FF] bg-opacity-50 font-semibold"
                      >
                        <option value="https://www.seriedays.com/%E0%B8%8B%E0%B8%B5%E0%B8%A3%E0%B8%B5%E0%B9%88%E0%B8%A2%E0%B9%8C%E0%B8%9E%E0%B8%B2%E0%B8%81%E0%B8%A2%E0%B9%8C%E0%B9%84%E0%B8%97%E0%B8%A2/">🇹🇭 ซีรี่ย์พากย์ไทย (Thai Dubbed)</option>
                        <option value="https://www.seriedays.com/%E0%B8%8B%E0%B8%B5%E0%B8%A3%E0%B8%B5%E0%B9%88%E0%B8%A2%E0%B9%8C%E0%B8%8B%E0%B8%B1%E0%B8%9A%E0%B9%84%E0%B8%97%E0%B8%A2/">💬 ซีรี่ย์ซับไทย (Thai Subbed)</option>
                        <option value="https://www.seriedays.com/%E0%B8%8B%E0%B8%B5%E0%B8%A3%E0%B8%B5%E0%B9%88%E0%B8%A2%E0%B9%8C%E0%B8%88%E0%B8%B5%E0%B8%99/">🇨🇳 ซีรี่ย์จีน (China Series)</option>
                        <option value="https://www.seriedays.com/%E0%B8%8B%E0%B8%B5%E0%B8%A3%E0%B8%B5%E0%B9%88%E0%B8%A2%E0%B9%8C%E0%B9%80%E0%B8%81%E0%B8%B2%E0%B8%AB%E0%B8%A5%E0%B8%B5/">🇰🇷 ซีรี่ย์เกาหลี (Korea Series)</option>
                        <option value="https://www.seriedays.com/%e0%b8%8b%e0%b8%b5%e0%b8%a3%e0%b8%b5%e0%b9%88%e0%b8%a2%e0%b9%8c%e0%b8%9d%e0%b8%a3%e0%b8%b1%e0%b9%88%e0%b8%87/">🇺🇸 ซีรี่ย์ฝรั่ง (Inter Series)</option>
                      </select>
                      <input
                        type="text"
                        disabled={isHarvesting}
                        value={categoryUrlSerieDays}
                        onChange={(e) => setCategoryUrlSerieDays(e.target.value)}
                        placeholder="หรือระบุ URL หมวดหมู่ตรงๆ"
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Start Page</label>
                      <input
                        type="number"
                        min="1"
                        disabled={isHarvesting}
                        value={startPageSerieDays}
                        onChange={(e) => setStartPageSerieDays(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">End Page</label>
                      <input
                        type="number"
                        min="1"
                        disabled={isHarvesting}
                        value={endPageSerieDays}
                        onChange={(e) => setEndPageSerieDays(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                  </div>

                  <span className="text-[10px] text-gray-500 bg-[#0d1117] p-3 rounded border border-[#2D333B] font-mono leading-relaxed">
                    🎬 ดึงซีรีส์จาก seriedays.com พร้อมถอดรหัสเซิร์ฟเวอร์เล่นวิดีโอ (main, hot, 24playerhd, getplay-cdn, m3u8) อัตโนมัติ
                  </span>
                </div>
              )}

              {/* 24HD Configuration Forms */}
              {activeTab === "24hd" && (
                <div className="flex flex-col gap-3 pt-1">
                  <div className="flex flex-col gap-1.5 pb-2 border-b border-[#2D333B]/60">
                    <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Target Category (24HD Movies)</label>
                    <div className="flex flex-col gap-2">
                      <select
                        disabled={isHarvesting}
                        value={categoryUrl24HD}
                        onChange={(e) => {
                          setCategoryUrl24HD(e.target.value);
                        }}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-[#58A6FF] text-xs font-mono focus:outline-none focus:border-[#58A6FF] bg-opacity-50 font-semibold"
                      >
                        <option value="https://www.24hd.vip/category/netflix/">🍿 หนัง Netflix (24hd.vip/category/netflix/)</option>
                        <option value="https://www.24hd.vip/category/inter-movie/">🎬 หนังฝรั่ง (24hd.vip/category/inter-movie/)</option>
                        <option value="https://www.24hd.vip/category/thai-movie/">🇹🇭 หนังไทย (24hd.vip/category/thai-movie/)</option>
                        <option value="https://www.24hd.vip/category/china-movie/">🇨🇳 หนังจีน (24hd.vip/category/china-movie/)</option>
                        <option value="https://www.24hd.vip/category/korea-movie/">🇰🇷 หนังเกาหลี (24hd.vip/category/korea-movie/)</option>
                        <option value="https://www.24hd.vip/category/anime/">⛩️ หนังอนิเมะ (24hd.vip/category/anime/)</option>
                      </select>
                      <input
                        type="text"
                        disabled={isHarvesting}
                        value={categoryUrl24HD}
                        onChange={(e) => setCategoryUrl24HD(e.target.value)}
                        placeholder="หรือระบุ URL หมวดหมู่ตรงๆ e.g. https://www.24hd.vip/category/..."
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Start Page</label>
                      <input
                        type="number"
                        min="1"
                        disabled={isHarvesting}
                        value={startPage24HD}
                        onChange={(e) => setStartPage24HD(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">End Page</label>
                      <input
                        type="number"
                        min="1"
                        disabled={isHarvesting}
                        value={endPage24HD}
                        onChange={(e) => setEndPage24HD(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                  </div>

                  <span className="text-[10px] text-gray-500 bg-[#0d1117] p-3 rounded border border-[#2D333B] font-mono leading-relaxed">
                    🚀 ดึงข้อมูลภาพยนตร์จาก 24hd.vip ถอดรหัส embed player (playermhd, player77hdfree, vdohls) เป็น m3u8 สตรีมมิ่งสดอัตโนมัติ
                  </span>
                </div>
              )}

              {/* DDNUNG Configuration Forms */}
              {activeTab === "ddnung" && (
                <div className="flex flex-col gap-3 pt-1">
                  <div className="flex flex-col gap-1.5 pb-2 border-b border-[#2D333B]/60">
                    <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Target Category (DDNung)</label>
                    <div className="flex flex-col gap-2">
                      <select
                        disabled={isHarvesting}
                        value={categoryUrlDDNung}
                        onChange={(e) => {
                          setCategoryUrlDDNung(e.target.value);
                        }}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-[#58A6FF] text-xs font-mono focus:outline-none focus:border-[#58A6FF] bg-opacity-50 font-semibold"
                      >
                        <option value="https://ddnung.com/series-country/korean-series/">🇰🇷 ซีรีย์เกาหลี (ddnung.com/series-country/korean-series/)</option>
                        <option value="https://ddnung.com/series-country/thai-series/">🇹🇭 ซีรีย์ไทย (ddnung.com/series-country/thai-series/)</option>
                        <option value="https://ddnung.com/year/2026/">🍿 หนัง/ซีรีย์ปี 2026 (ddnung.com/year/2026/)</option>
                        <option value="https://ddnung.com/series/">📺 ซีรีย์ทั้งหมด (ddnung.com/series/)</option>
                        <option value="https://ddnung.com/movie/">🎬 หนังทั้งหมด (ddnung.com/movie/)</option>
                        <option value="https://ddnung.com/country/inter/">🌐 หนัง/ซีรีย์ฝรั่ง Inter (ddnung.com/country/inter/)</option>
                        <option value="https://ddnung.com/series-country/chinese-series/">🇨🇳 ซีรีย์จีน (ddnung.com/series-country/chinese-series/)</option>
                        <option value="https://ddnung.com/series-country/anime-series/">⛩️ ซีรีย์อนิเมะ (ddnung.com/series-country/anime-series/)</option>
                      </select>
                      <input
                        type="text"
                        disabled={isHarvesting}
                        value={categoryUrlDDNung}
                        onChange={(e) => setCategoryUrlDDNung(e.target.value)}
                        placeholder="หรือระบุ URL หมวดหมู่ตรงๆ e.g. https://ddnung.com/..."
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Start Page</label>
                      <input
                        type="number"
                        min="1"
                        disabled={isHarvesting}
                        value={startPageDDNung}
                        onChange={(e) => setStartPageDDNung(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">End Page</label>
                      <input
                        type="number"
                        min="1"
                        disabled={isHarvesting}
                        value={endPageDDNung}
                        onChange={(e) => setEndPageDDNung(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                  </div>

                  <span className="text-[10px] text-gray-500 bg-[#0d1117] p-3 rounded border border-[#2D333B] font-mono leading-relaxed">
                    🚀 ดึงข้อมูลภาพยนตร์/ซีรีย์จาก ddnung.com ถอดรหัส embed player (seetvplay, hdplayfull, player77hdfree, playermhd, vdohls) เป็น m3u8 สตรีมมิ่งสดอัตโนมัติ
                  </span>
                </div>
              )}

              {/* W3U Configuration Forms */}
              {activeTab === "w3u" && (
                <div className="flex flex-col gap-4 pt-1">
                  {/* File dropzone / selector */}
                  <div className="flex flex-col gap-1.5 font-mono">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider">
                        JSON / W3U Playlists (.json / .w3u / Playlistss.txt)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const pyScript = `# -*- coding: utf-8 -*-

import json
import os
from urllib.parse import quote

INPUT_FILE = "Playlistss.txt"
OUTPUT_FILE = "playlist.m3u"

def fix_url(url):
    if not url:
        return ""
    if url.startswith("//"):
        return "https:" + url
    return url

def clean_name(text):
    if not text:
        return "Unknown"
    return (
        text
        .replace("\\n", " ")
        .replace(",", " ")
        .strip()
    )

def convert():
    if not os.path.exists(INPUT_FILE):
        print("ไม่พบไฟล์:", INPUT_FILE)
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        movies = json.load(f)

    playlist = []
    playlist.append("#EXTM3U")
    playlist.append('#EXT-X-PLAYLIST-TYPE:VOD')

    count = 0
    for movie in movies:
        title = clean_name(movie.get("title"))
        poster = movie.get("poster", "")
        streams = movie.get("streams", [])

        for ep in streams:
            episode = clean_name(ep.get("episode_name", "EP"))
            url = ep.get("original_url") or ep.get("stream_url")
            url = fix_url(url)
            if not url:
                continue

            group = title
            extinf = (
                '#EXTINF:-1 '
                f'tvg-id="{quote(title)}" '
                f'tvg-logo="{poster}" '
                f'group-title="{group}",'
                f'{title} - {episode}'
            )
            playlist.append(extinf)
            playlist.append(url)
            count += 1

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\\n".join(playlist))

    print("==============================")
    print("สร้าง Playlist สำเร็จ")
    print("ไฟล์:", OUTPUT_FILE)
    print("จำนวนรายการ:", count)
    print("==============================")

if __name__ == "__main__":
    convert()
`;
                          downloadM3U(pyScript, "convert.py");
                        }}
                        className="text-[10px] text-[#58A6FF] hover:underline flex items-center gap-1 cursor-pointer"
                        title="ดาวน์โหลดไฟล์ Python สคริปต์สกัด M3U"
                      >
                        🐍 ดาวน์โหลด convert.py
                      </button>
                    </div>

                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setW3uIsDragging(true);
                      }}
                      onDragLeave={() => setW3uIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setW3uIsDragging(false);
                        const file = e.dataTransfer.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const text = event.target?.result as string;
                            setW3uRawText(text);
                            addLog(`📂 ลากและวางไฟล์สำเร็จ: ${file.name} (${Math.round(file.size / 1024)} KB)`, "success");
                          };
                          reader.readAsText(file);
                        }
                      }}
                      className={cn(
                        "border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all gap-2",
                        w3uIsDragging
                          ? "border-[#58A6FF] bg-[#58A6FF]/5"
                          : "border-[#2D333B] hover:border-gray-500 bg-[#0D1117]"
                      )}
                      onClick={() => {
                        const fileInput = document.createElement("input");
                        fileInput.type = "file";
                        fileInput.accept = ".w3u,.json,.txt";
                        fileInput.onchange = (e) => {
                          const file = (e.currentTarget as HTMLInputElement).files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const text = event.target?.result as string;
                              setW3uRawText(text);
                              addLog(`📂 โหลดไฟล์สำเร็จ: ${file.name} (${Math.round(file.size / 1024)} KB)`, "success");
                            };
                            reader.readAsText(file);
                          }
                        };
                        fileInput.click();
                      }}
                    >
                      <FolderOpen className="text-gray-500 group-hover:text-[#58A6FF] transition-all" size={24} />
                      <div>
                        <p className="text-xs text-gray-300 font-medium">ลากไฟล์ Playlistss.txt / .json มาวางที่นี่ หรือคลิกเพื่ออัพโหลด</p>
                        <p className="text-[10px] text-gray-500 mt-1">แปลง JSON Format (title, poster, streams) เป็น M3U Playlist (VOD)</p>
                      </div>
                    </div>
                  </div>

                  {/* Raw Text area paste */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
                        หรือ วางข้อความ JSON (Playlistss.txt / W3U Format)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const sampleJson = JSON.stringify([
                            {
                              "movie_id": "101",
                              "title": "ซีรี่ย์ไทย หนังเด็ด 2026",
                              "poster": "https://picsum.photos/seed/thai-movie/300/450",
                              "streams": [
                                {
                                  "episode_name": "ตอนที่ 1 (EP01)",
                                  "original_url": "https://media.vdohls.com/sample-ep1/playlist.m3u8"
                                },
                                {
                                  "episode_name": "ตอนที่ 2 (EP02)",
                                  "stream_url": "//media.vdohls.com/sample-ep2/playlist.m3u8"
                                }
                              ]
                            }
                          ], null, 2);
                          setW3uRawText(sampleJson);
                          addLog("📄 ใส่ตัวอย่างโครงสร้าง JSON (Playlistss.txt) เรียบร้อยแล้ว", "info");
                        }}
                        className="text-[10px] text-[#58A6FF] hover:underline cursor-pointer font-mono"
                      >
                        + ใส่ตัวอย่าง Playlistss.txt
                      </button>
                    </div>
                    <textarea
                      value={w3uRawText}
                      onChange={(e) => setW3uRawText(e.target.value)}
                      placeholder='[ { "title": "...", "poster": "...", "streams": [ { "episode_name": "EP01", "original_url": "https://..." } ] } ]'
                      rows={6}
                      className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-2 text-white text-[11px] font-mono resize-none focus:outline-none focus:border-[#58A6FF] bg-opacity-50"
                    />
                  </div>

                  {/* Extra options flags */}
                  <div className="flex items-center justify-between border-t border-[#2D333B]/60 pt-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-mono text-gray-300">ตัวเลือกพิเศษ (Extra VLC Options)</span>
                      <span className="text-[10px] text-gray-500 font-mono">เพิ่มฟลาก User-Agent ของช่องใน M3U8</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setW3uExtraFlags(!w3uExtraFlags)}
                      className={cn(
                        "w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer",
                        w3uExtraFlags ? "bg-[#58A6FF] flex justify-end" : "bg-[#2D333B] flex justify-start"
                      )}
                    >
                      <motion.div layout className="w-4.5 h-4.5 rounded-full bg-[#0D1117]" />
                    </button>
                  </div>
                </div>
              )}

              {/* MoviesDooFree Configuration Forms */}
              {activeTab === "moviesdoofree" && (
                <div className="flex flex-col gap-4 pt-1 font-mono">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider flex items-center justify-between">
                      <span>BASE TARGET URL (เว็บไซต์หลัก)</span>
                      <span className="text-amber-400 font-semibold">MOVIESDOOFREE.COM</span>
                    </label>
                    <input
                      type="text"
                      value={baseUrlMoviesDooFree}
                      onChange={(e) => setBaseUrlMoviesDooFree(e.target.value)}
                      placeholder="https://moviesdoofree.com/"
                      className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-[#58A6FF]"
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="text-gray-500 self-center">Presets:</span>
                    <button
                      type="button"
                      onClick={() => setBaseUrlMoviesDooFree("https://moviesdoofree.com/")}
                      className="px-2 py-0.5 bg-[#161B22] hover:bg-[#21262d] border border-[#2D333B] rounded text-amber-400 cursor-pointer"
                    >
                      moviesdoofree.com (หน้าหลัก)
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider">
                        START PAGE (หน้าเริ่มต้น)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={startPageMoviesDooFree}
                        onChange={(e) => setStartPageMoviesDooFree(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-400 uppercase tracking-wider">
                        END PAGE (หน้าสุดท้าย)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={endPageMoviesDooFree}
                        onChange={(e) => setEndPageMoviesDooFree(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-[#58A6FF]"
                      />
                    </div>
                  </div>

                  <span className="text-[10px] text-gray-500 bg-[#0d1117] p-3 rounded border border-[#2D333B] leading-relaxed">
                    🎬 <strong>ระบบดึงข้อมูล MoviesDooFree Auto Scraper</strong> ดึงลิงก์หนัง, ปก, เรื่องย่อ และสตรีมมิ่งวิดีโอ <code>.m3u8</code> จากเครื่องเล่นไอเฟรมอัตโนมัติ (m3u8haha.com) รองรับการส่งออกไฟล์ W3U / M3U
                  </span>
                </div>
              )}

              {/* Proxy Configuration Forms */}
              {activeTab === "proxy" && (
                <div className="flex flex-col gap-4 pt-1 font-mono">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Target Website URL (URL ปลายทาง)</span>
                      <span className="text-emerald-400 font-semibold">GET /proxy/?url=...</span>
                    </label>
                    <input
                      type="text"
                      value={proxyTargetUrl}
                      onChange={(e) => setProxyTargetUrl(e.target.value)}
                      placeholder="https://wow-drama.com/"
                      className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-[#3FB950]"
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="text-gray-500 self-center">Presets:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setProxyTargetUrl("https://wow-drama.com/");
                        setProxyReferer("https://wow-drama.com/");
                      }}
                      className="px-2 py-0.5 bg-[#161B22] hover:bg-[#21262d] border border-[#2D333B] rounded text-emerald-400 cursor-pointer"
                    >
                      wow-drama.com
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProxyTargetUrl("https://ok-serie.tv/");
                        setProxyReferer("https://ok-serie.tv/");
                      }}
                      className="px-2 py-0.5 bg-[#161B22] hover:bg-[#21262d] border border-[#2D333B] rounded text-[#58A6FF] cursor-pointer"
                    >
                      ok-serie.tv
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProxyTargetUrl("https://123hdtv.net/");
                        setProxyReferer("https://123hdtv.net/");
                      }}
                      className="px-2 py-0.5 bg-[#161B22] hover:bg-[#21262d] border border-[#2D333B] rounded text-amber-400 cursor-pointer"
                    >
                      123hdtv.net
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProxyTargetUrl("https://ddnung.com/");
                        setProxyReferer("https://ddnung.com/");
                      }}
                      className="px-2 py-0.5 bg-[#161B22] hover:bg-[#21262d] border border-[#2D333B] rounded text-purple-400 cursor-pointer"
                    >
                      ddnung.com
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wider">
                      Custom Referer Header (ค่า Referer)
                    </label>
                    <input
                      type="text"
                      value={proxyReferer}
                      onChange={(e) => setProxyReferer(e.target.value)}
                      placeholder="https://wow-drama.com/"
                      className="w-full bg-[#161B22] border border-[#2D333B] rounded px-3 py-2 text-white text-xs focus:outline-none focus:border-[#3FB950]"
                    />
                  </div>

                  {/* Generated Endpoint Box */}
                  <div className="bg-[#0D1117] border border-[#2D333B] rounded p-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-gray-400">PROXIED ENDPOINT URL</span>
                      <button
                        type="button"
                        onClick={() => {
                          const fullUrl = `${window.location.origin}/proxy/?url=${encodeURIComponent(proxyTargetUrl)}&referer=${encodeURIComponent(proxyReferer)}`;
                          copyToClipboard(fullUrl, "proxy-url");
                          addLog("📋 คัดลอก Proxy URL เรียบร้อยแล้ว", "success");
                        }}
                        className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedId === "proxy-url" ? <Check size={11} /> : <Copy size={11} />}
                        <span>{copiedId === "proxy-url" ? "COPIED" : "COPY FULL PROXY URL"}</span>
                      </button>
                    </div>
                    <div className="bg-[#161B22] p-2 rounded text-[11px] text-emerald-400 break-all select-all border border-[#2D333B]/80 font-mono">
                      /proxy/?url={encodeURIComponent(proxyTargetUrl)}&referer={encodeURIComponent(proxyReferer)}
                    </div>
                  </div>

                  {/* Test Output Box */}
                  {proxyTestResult && (
                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-400 uppercase">PROXIED RESPONSE RESULT</span>
                        <span className="text-emerald-400">{proxyStatus}</span>
                      </div>
                      <pre className="bg-[#010409] border border-[#2D333B] rounded p-3 text-[10px] text-gray-300 overflow-x-auto max-h-48 whitespace-pre-wrap break-all scrollbar-thin scrollbar-thumb-[#2D333B]">
                        {proxyTestResult}
                      </pre>
                    </div>
                  )}

                  <span className="text-[10px] text-gray-500 bg-[#0d1117] p-3 rounded border border-[#2D333B] leading-relaxed">
                    🌐 <strong>ระบบ Proxy Web Server</strong> รองรับ GET/POST/OPTIONS สำหรับข้าม CORS, Bypass Hotlink, และกำหนด Custom Referer / User-Agent อัตโนมัติสำหรับดึงเว็บไซต์และวิดีโอสตรีมมิ่ง
                  </span>
                </div>
              )}

              {/* Advanced collapsable settings block */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-[#0D1117] rounded p-4 border border-[#2D333B] flex flex-col gap-3.5"
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] uppercase text-gray-400 font-mono tracking-wider">หน่วงเวลาดีเลย์ระลอกซีรีย์</label>
                        <span className="text-xs text-[#58A6FF] font-mono font-semibold">{delayMs} ms</span>
                      </div>
                      <input
                        type="range"
                        min="200"
                        max="5000"
                        step="100"
                        disabled={isHarvesting}
                        value={delayMs}
                        onChange={(e) => setDelayMs(parseInt(e.target.value))}
                        className="w-full accent-[#58A6FF] cursor-pointer disabled:opacity-50"
                      />
                      <span className="text-[10px] text-gray-500 leading-tight font-mono">
                        *ช่วยลดโอกาสโดนแบนไอพีและการปฏิเสธคำขอจาก Cloudflare แนะนำ 1000ms+
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-[#2D333B] pt-3.5">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono text-gray-300">ล้างลิสต์ข้อมูลก่อนหน้า</span>
                        <span className="text-[10px] text-gray-500 font-mono">ล้างคลังซีรีย์ชุดเก่าก่อนเริ่มดึงรอบใหม่</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => !isHarvesting && setClearPrevious(!clearPrevious)}
                        disabled={isHarvesting}
                        className={cn(
                          "w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer disabled:opacity-50",
                          clearPrevious ? "bg-[#58A6FF] flex justify-end" : "bg-[#2D333B] flex justify-start"
                        )}
                      >
                        <motion.div layout className="w-4.5 h-4.5 rounded-full bg-[#0D1117]" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Status Box block if harvesting */}
              {isHarvesting && (
                <div className="bg-[#161B22] p-4 border border-[#2D333B] border-l-4 border-l-[#58A6FF] rounded-r">
                  <div className="text-xs font-bold text-[#58A6FF] mb-1.5 font-mono animate-pulse uppercase tracking-wider">
                    📍 {isPaused ? "HARVEST STATUS: PAUSED" : "HARVEST STATUS: RUNNING"}
                  </div>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-[#0d1117] h-1.5 border border-[#2d333b] rounded overflow-hidden mt-3 mb-2.5">
                    <motion.div 
                      className="bg-[#58A6FF] h-full"
                      animate={{ 
                        width: `${currentProgress.totalSeriesInPage > 0 ? (currentProgress.seriesIndex / currentProgress.totalSeriesInPage) * 100 : 0}%` 
                      }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>

                  <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1">
                    <span>PAGE INDEX: <strong className="text-white">{currentProgress.page}</strong></span>
                    <span>QUEUE: <strong className="text-white">{currentProgress.seriesIndex} / {currentProgress.totalSeriesInPage}</strong></span>
                  </div>

                  <div className="text-[10px] text-gray-500 font-mono truncate border-t border-[#2D333B] mt-2.5 pt-2.5 flex items-center gap-1.5">
                    <Film size={11} className="text-[#58A6FF]" />
                    <span className="uppercase text-[9px]">TARGET: </span>
                    <span className="text-gray-300 font-bold max-w-[240px] truncate">{currentProgress.currentSeriesName}</span>
                  </div>
                </div>
              )}

              {/* Primary action controls */}
              <div className="flex flex-col sm:flex-row gap-3 mt-1">
                {!isHarvesting ? (
                  <button
                    onClick={handleExecuteActiveHarvester}
                    id="btn-start"
                    style={{ backgroundColor: "#10a803" }}
                    className="flex-1 py-3.5 bg-[#58A6FF] hover:bg-blue-400 text-[#0D1117] font-bold font-mono tracking-widest text-xs uppercase hover:text-black rounded transition-all select-none flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {activeTab === "w3u" ? <RotateCcw size={14} /> : activeTab === "proxy" ? <Globe size={14} /> : <Play size={14} fill="currentColor" />}
                    <span>{activeTab === "w3u" ? "⚡ CONVERT PLAYLIST" : activeTab === "proxy" ? "🌐 TEST PROXY REQUEST" : "🚀 EXECUTE HARVESTER"}</span>
                  </button>
                ) : (
                  <div className="flex flex-1 gap-2.5 w-full">
                    <button
                      onClick={togglePause}
                      id="btn-pause"
                      className="flex-1 bg-[#2D333B] hover:bg-[#343b45] text-white font-mono text-xs uppercase tracking-wider rounded transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
                      <span>{isPaused ? "RESUME" : "PAUSE"}</span>
                    </button>
                    
                    <button
                      onClick={stopHarvesting}
                      id="btn-stop"
                      className="flex-1 bg-[#F85149] hover:bg-[#da3633] text-white font-mono text-xs uppercase tracking-wider rounded transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X size={12} />
                      <span>STOP</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Statistics Mini Widget */}
          <div className="bg-[#11141B] border border-[#2D333B] rounded p-4 flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#58A6FF]/10 border border-[#58A6FF]/20 text-[#58A6FF] rounded">
                <Tv size={16} />
              </div>
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">SERIES EXTRACTED</div>
                <div className="text-base font-bold text-white leading-tight font-mono mt-0.5">
                  {aggregateStats.seriesCount} <span className="text-[10px] font-normal text-gray-400 font-sans">ITEMS</span>
                </div>
              </div>
            </div>

            <div className="w-[1px] h-8 bg-[#2D333B]" />

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#3FB950]/10 border border-[#3FB950]/20 text-[#3FB950] rounded">
                <Film size={16} />
              </div>
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider font-mono">LINKS GATHERED</div>
                <div className="text-base font-bold text-white leading-tight font-mono mt-0.5">
                  {aggregateStats.episodeCount} <span className="text-[10px] font-normal text-gray-400 font-sans">EPS</span>
                </div>
              </div>
            </div>

            {activeSeriesList.length > 0 && (
              <button
                onClick={() => downloadM3U(generateMergedM3U(), `${activeTab}-merged-all.m3u`)}
                className="p-1.5 bg-[#161B22] hover:bg-[#58A6FF] border border-[#2D333B] hover:border-[#58A6FF] rounded text-gray-400 hover:text-black transition-all cursor-pointer"
                title="ดาวน์โหลดซีรีย์รวมทั้งหมด (.m3u)"
              >
                <Download size={15} />
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Scraper Logging Terminal Console - spanning 7 grid slots */}
        <div className="lg:col-span-7 h-full flex flex-col">
          <div className="bg-[#010409] border border-[#2D333B] rounded overflow-hidden shadow-2xl flex flex-col h-[385px]">
            <div className="px-4 py-3 border-b border-[#2D333B] flex items-center justify-between bg-[#161B22]">
              <div className="flex items-center gap-2 text-gray-400">
                <Terminal size={12} className="text-[#58A6FF]" />
                <span className="text-[10px] font-bold font-mono tracking-wider uppercase text-gray-300">Runtime Debug Console</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearLogs}
                  className="px-2 py-0.5 text-[9px] font-mono hover:bg-[#202530] text-gray-400 hover:text-white rounded border border-[#2D333B] transition-colors cursor-pointer"
                >
                  CLEAR
                </button>
              </div>
            </div>

            {/* Terminal Body content */}
            <div 
              ref={logContainerRef}
              className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-1.5 bg-[#010409] scrollbar-thin scrollbar-thumb-[#2D333B]"
            >
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 text-center select-none py-12 gap-2" style={{ borderStyle: "double", backgroundColor: "#262333" }}>
                  <Terminal size={20} className="opacity-25" />
                  <p className="text-gray-500 text-[10px] uppercase font-mono tracking-wider">[ READY FOR DISCOVERY ]</p>
                  <p className="text-gray-500 text-[10px] max-w-xs leading-normal font-sans">
                    กรอกหน้าเริ่มต้นทางกล่องแผงควบคุม แล้วคลิก &quot;🚀 EXECUTE HARVESTER&quot; เพื่อดึงข้อมูลซีรีย์
                  </p>
                </div>
              ) : (
                logs.map((log, index) => {
                  let badge = "INFO";
                  let badgeClass = "text-[#58A6FF]";
                  if (log.type === "success") {
                    badge = "OK";
                    badgeClass = "text-[#3FB950]";
                  } else if (log.type === "warn") {
                    badge = "WARN";
                    badgeClass = "text-[#D29922]";
                  } else if (log.type === "error") {
                    badge = "FAIL";
                    badgeClass = "text-[#F85149] font-bold";
                  }

                  return (
                    <div key={index} className="flex items-start gap-2 leading-relaxed tracking-wide text-[#8B949E]">
                      <span className="text-gray-600 flex-shrink-0">[{log.timestamp}]</span>
                      <span className="flex-shrink-0">
                        [<span className={badgeClass}>{badge}</span>]
                      </span>
                      <span className="break-all text-gray-300">
                        {log.message}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>

      {/* SEARCH AND GRID ACTION BAR */}
      <div className="bg-[#11141B] border border-[#2D333B] rounded p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between shadow-md">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:max-w-xl">
          {filteredSeriesList.length > 0 && (
            <label className="flex items-center gap-2 px-3 py-2 bg-[#161B22] border border-[#2D333B] rounded text-xs font-mono text-gray-300 cursor-pointer hover:border-[#58A6FF]/40 transition-colors select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 accent-[#58A6FF] bg-[#0D1117] border-[#2D333B] rounded cursor-pointer"
              />
              <span className="text-[11px] font-semibold">
                เลือกทั้งหมด ({selectedSeriesIds.length}/{filteredSeriesList.length})
              </span>
            </label>
          )}

          <div className="relative flex-1 w-full">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="🔍 ค้นหาซีรีย์ในตารางผลลัพธ์..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#161B22] border border-[#2D333B] rounded pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#58A6FF] font-sans"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end items-center">
          {selectedSeriesIds.length > 0 && (
            <button
              onClick={handleDeleteSelectedSeries}
              className="px-3.5 py-1.5 bg-[#F85149] hover:bg-[#da3633] text-white font-bold text-[11px] font-mono rounded transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              title="ลบซีรีส์ที่เลือกทั้งหมด"
            >
              <Trash2 size={13} />
              <span>ลบที่เลือก ({selectedSeriesIds.length})</span>
            </button>
          )}

          {activeSeriesList.length > 0 && (
            <>
              <button
                onClick={() => {
                  const mergedM3U = generateMergedM3U();
                  copyToClipboard(mergedM3U, "merged-bulk");
                  addLog("📋 คัดลอกเพลย์ลิสต์รวบรวมทั้งหมดแล้ว!", "success");
                }}
                className="px-3.5 py-1.5 bg-[#161B22] hover:bg-[#58A6FF]/10 hover:text-[#58A6FF] text-gray-300 border border-[#2D333B] text-[11px] font-mono rounded transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {copiedId === "merged-bulk" ? <Check size={12} className="text-[#3FB950]" /> : <Copy size={12} />}
                <span>{copiedId === "merged-bulk" ? "COPIED!" : "COPY BULK M3U"}</span>
              </button>

              <button
                onClick={() => downloadM3U(generateMergedM3U(), `${activeTab}-series-bulk.m3u`)}
                className="px-3.5 py-1.5 bg-[#3FB950] hover:bg-emerald-400 text-[#0A0C10] font-bold text-[11px] font-mono rounded transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={12} />
                <span>DOWNLOAD ALL M3U ({activeSeriesList.length})</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* GRID SECTOR: Scraped Series Cards */}
      {filteredSeriesList.length === 0 ? (
        <div className="bg-[#11141B] border border-[#2D333B] border-dashed rounded p-16 flex flex-col items-center justify-center text-center gap-4" style={{ backgroundColor: "#161616" }}>
          <div className="w-12 h-12 bg-[#161B22] border border-[#2D333B] rounded flex items-center justify-center text-gray-500">
            <Film size={20} />
          </div>
          <div className="max-w-md">
            <h3 className="text-sm font-bold text-white mb-1 font-mono uppercase tracking-wider">Empty Result Set</h3>
            <p className="text-xs text-gray-400 font-sans">
              {searchQuery ? "ไม่พบข้อมูลซีรีย์ที่ค้นหา ลองพิมพ์ตัวอักษรอื่น" : "ปรับพารามิเตอร์ของหน้าแล้วเริ่มคลิก '🚀 EXECUTE HARVESTER' เพื่อเก็บเกี่ยวข้อมูล!"}
            </p>
          </div>
        </div>
      ) : (
        <motion.div 
          layout 
          style={{ backgroundColor: "#161616" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredSeriesList.map((item) => {
            const m3uContent = generateM3UOfSeries(item);
            const isSelected = selectedSeriesIds.includes(item.id);
            return (
              <motion.div
                layout
                key={item.id}
                className={cn(
                  "bg-[#11141B] border rounded overflow-hidden shadow transition-all flex flex-col group relative",
                  isSelected
                    ? "border-[#58A6FF] ring-1 ring-[#58A6FF] border-l-4 border-l-[#58A6FF]"
                    : "border-[#2D333B] border-l-4 border-l-[#58A6FF] hover:border-[#58A6FF]/40"
                )}
              >
                {/* Visual Thumbnail */}
                <div className="relative h-44 w-full bg-black overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.poster}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${item.id}/400/220`;
                    }}
                  />
                  
                  {/* Overlay background shade */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  
                  {/* Select Checkbox Overlay (Top-Left) */}
                  <label 
                    onClick={(e) => e.stopPropagation()} 
                    className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-[#0D1117]/90 backdrop-blur-sm border border-[#2D333B] hover:border-[#58A6FF] px-2 py-1 rounded cursor-pointer transition-colors shadow-md select-none"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectSeries(item.id)}
                      className="w-4 h-4 accent-[#58A6FF] bg-[#0D1117] border-[#2D333B] rounded cursor-pointer"
                    />
                    <span className="text-[10px] font-mono font-bold text-gray-200">
                      {isSelected ? "SELECTED" : "SELECT"}
                    </span>
                  </label>

                  {/* Badges & Delete Button Overlay (Top-Right) */}
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 bg-[#161B22]/90 border border-[#2D333B] text-white rounded text-[10px] font-mono leading-none flex items-center">
                      P. {item.pageNum}
                    </span>
                    <span className="px-2 py-0.5 bg-[#58A6FF] text-[#0D1117] font-mono font-bold rounded text-[10px] leading-none flex items-center">
                      {item.episodes.length} EPS
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSingleSeries(item.id, item.title, e)}
                      className="p-1 bg-[#F85149]/20 hover:bg-[#F85149] text-[#F85149] hover:text-white border border-[#F85149]/40 rounded transition-all cursor-pointer shadow-md"
                      title="ลบซีรีส์นี้"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Card Info Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-1 mb-1.5 tracking-tight group-hover:text-[#58A6FF] transition-colors" title={item.title}>
                      {item.title}
                    </h3>
                    
                    <p className="text-[10px] text-gray-500 font-mono mb-3.5 break-all">
                      ID: {item.id}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-[#2D333B] pt-3 mt-auto">
                    
                    {/* Expand Stream Items buttons */}
                    <button
                      onClick={() => handleSelectSeries(selectedSeries?.id === item.id ? null : item)}
                      className="w-full py-1.5 bg-[#161B22] hover:bg-[#202530] border border-[#2D333B] hover:border-[#58A6FF]/20 font-mono text-[10px] text-gray-200 rounded transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FolderOpen size={11} className="text-[#58A6FF]" />
                      <span>{selectedSeries?.id === item.id ? "CLOSE FOLDER" : "OPEN EPISODE DIRECT STREAM"}</span>
                    </button>

                    {activeTab === "123hdtv" ? (
                      <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => copyToClipboard(m3uContent, item.id)}
                            className="py-1.5 bg-[#161B22] hover:bg-[#202530] border border-[#2D333B] font-mono text-[10px] text-gray-300 rounded transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {copiedId === item.id ? <Check size={11} className="text-[#3FB950]" /> : <Copy size={11} />}
                            <span>COPY M3U</span>
                          </button>

                          <button
                            onClick={() => {
                              copyToClipboard(generateJSONOfSeries(item), `${item.id}-json`);
                              addLog(`📋 คัดลอกรูปแบบ JSON ของซีรีย์ ${item.title} แล้ว!`, "success");
                            }}
                            className="py-1.5 bg-[#161B22] hover:bg-[#202530] border border-[#2D333B] font-mono text-[10px] text-gray-300 rounded transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {copiedId === `${item.id}-json` ? <Check size={11} className="text-[#3FB950]" /> : <Copy size={11} />}
                            <span>COPY JSON</span>
                          </button>
                        </div>

                        <button
                          onClick={() => downloadM3U(m3uContent, `${item.id}-playlist.m3u`)}
                          className="py-1.5 bg-[#3FB950]/15 hover:bg-[#3FB950]/25 text-[#3FB950] border border-[#3FB950]/30 font-mono text-[10px] rounded transition-colors flex items-center justify-center gap-1 cursor-pointer w-full"
                        >
                          <Download size={11} />
                          <span>DOWNLOAD M3U</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => copyToClipboard(m3uContent, item.id)}
                          className="py-1.5 bg-[#161B22] hover:bg-[#202530] border border-[#2D333B] font-mono text-[10px] text-gray-300 rounded transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {copiedId === item.id ? <Check size={11} className="text-[#3FB950]" /> : <Copy size={11} />}
                          <span>COPY M3U</span>
                        </button>

                        <button
                          onClick={() => downloadM3U(m3uContent, `${item.id}-playlist.m3u`)}
                          className="py-1.5 bg-[#161B22] hover:bg-[#202530] border border-[#2D333B] font-mono text-[10px] text-gray-300 rounded transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Download size={11} className="text-[#58A6FF]" />
                          <span>DOWNLOAD</span>
                        </button>
                      </div>
                    )}

                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* DIALOG DETAILS MODAL: Expanding individual series details logic */}
      <AnimatePresence>
        {selectedSeries && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop cover overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleSelectSeries(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm cursor-pointer"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-4xl bg-[#11141B] border border-[#2D333B] rounded overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh]"
            >
              {/* Top title info bar */}
              <div className="px-5 py-3 border-b border-[#2D333B] flex justify-between items-center bg-[#161B22]">
                <div className="flex items-center gap-3">
                  <span className="p-1.5 bg-[#58A6FF]/10 text-[#58A6FF] rounded">
                    <Tv size={15} />
                  </span>
                  <div>
                    <h3 className="font-bold text-white text-xs leading-none pr-4 line-clamp-1 font-mono uppercase tracking-wider">{selectedSeries.title}</h3>
                    <p className="text-[10px] text-gray-500 font-mono mt-1">ID: {selectedSeries.id} | Page: {selectedSeries.pageNum}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => handleSelectSeries(null)}
                  className="p-1 hover:bg-[#202530] text-gray-400 hover:text-white rounded transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Integrated HD Widescreen Video Player */}
              <div className="w-full aspect-video bg-[#010409] border-b border-[#2D333B] relative group overflow-hidden flex flex-col items-center justify-center">
                {activeEpisode ? (
                  <div className="w-full h-full relative">
                    <video
                      ref={videoRef}
                      controls
                      playsInline
                      className="w-full h-full object-contain"
                    />
                    {/* Floating Info Overlay */}
                    <div className="absolute top-3 left-3 bg-[#0D1117]/85 backdrop-blur-md px-2.5 py-1 rounded text-[10px] font-mono border border-[#2D333B] text-[#58A6FF] pointer-events-none flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-[#58A6FF] rounded-full animate-ping" />
                      <span>DIRECT CAPTURE: {activeEpisode.title}</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full relative flex flex-col items-center justify-center p-6 text-center select-none">
                    <div className="absolute inset-0 opacity-15 blur-md pointer-events-none">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={selectedSeries.poster} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0D1117] via-[#010409]/90 to-transparent" />
                    
                    <div className="relative z-10 flex flex-col items-center gap-3.5">
                      <button
                        onClick={() => {
                          if (sortedEpisodesOfSelectedSeries.length > 0) {
                            setActiveEpisode({
                              title: sortedEpisodesOfSelectedSeries[0].title,
                              url: sortedEpisodesOfSelectedSeries[0].url,
                              index: 0
                            });
                          }
                        }}
                        className="w-14 h-14 bg-[#58A6FF]/10 hover:bg-[#58A6FF]/25 border border-[#58A6FF]/35 hover:border-[#58A6FF]/60 text-[#58A6FF] rounded-full flex items-center justify-center cursor-pointer hover:scale-105 transition-all shadow-xl group/btn animate-pulse"
                      >
                        <Play size={22} className="ml-0.5 text-[#58A6FF] transition-transform duration-300 group-hover/btn:scale-110" fill="currentColor" />
                      </button>
                      <div>
                        <span className="text-[9px] text-[#58A6FF] uppercase tracking-widest font-mono border border-[#58A6FF]/25 px-2 py-0.5 rounded bg-[#58A6FF]/5">STREAM PLAYER PORT</span>
                        <h3 className="text-sm font-bold text-gray-200 mt-2 font-mono uppercase tracking-wider">{selectedSeries.title}</h3>
                        <p className="text-xs text-gray-400 mt-1.5">คลิกที่ปุ่มเพื่อเล่นตอนแรก หรือเลือกตอนเฉพาะเจาะจงจากลิสต์ด้านล่าง</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Body lists containing actual scraped streaming items */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#0D1117]">
                <div className="flex flex-col md:flex-row gap-5">
                  {/* Left part preview thumbnail */}
                  <div className="hidden md:flex flex-col gap-3 w-32 flex-shrink-0">
                    <div className="aspect-[3/4.2] rounded overflow-hidden border border-[#2D333B] bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedSeries.poster}
                        alt={selectedSeries.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${selectedSeries.id}/300/440`;
                        }}
                      />
                    </div>
                  </div>

                  {/* Right segment detailing episode stream data */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center justify-between border-b border-[#2D333B]/40 pb-1.5 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-wider">
                          <span>EPISODE MATRIX STREAM</span>
                        </h4>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-[#58A6FF]/15 text-[#58A6FF] rounded border border-[#58A6FF]/30">
                          {sortedEpisodesWithIndex.length}
                          {selectedSeasonFilter !== "all" ? ` / ${selectedSeries.episodes.length}` : ""} EPS
                        </span>
                        {selectedSeasonFilter !== "all" && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 bg-amber-500/15 text-amber-400 rounded border border-amber-500/30 flex items-center gap-1">
                            <span>SEASON {selectedSeasonFilter}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedSeasonFilter("all")}
                              className="hover:text-white cursor-pointer ml-0.5 font-bold"
                              title="ล้างตัวกรองซีซั่น"
                            >
                              ×
                            </button>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setShowAddEpForm(!showAddEpForm);
                            if (showAddEpForm) {
                              setEditingEpIndex(null);
                              setInputEpTitle("");
                              setInputEpUrl("");
                            }
                          }}
                          className="px-2 py-0.5 bg-[#58A6FF]/15 hover:bg-[#58A6FF]/25 border border-[#58A6FF]/40 text-[#58A6FF] rounded text-[10px] font-mono flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Plus size={11} />
                          <span>{showAddEpForm ? "ปิดฟอร์ม" : "+ เพิ่ม EP"}</span>
                        </button>

                        {activeEpisode && (
                          <button 
                            onClick={() => setActiveEpisode(null)}
                            className="text-[9px] text-[#F85149] hover:underline uppercase font-mono tracking-wider cursor-pointer"
                          >
                            [ STOP STREAM ]
                          </button>
                        )}
                      </div>
                    </div>

                    {/* EP Add / Edit Form Card */}
                    <AnimatePresence>
                      {showAddEpForm && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mb-3 p-3 bg-[#161B22] border border-[#58A6FF]/30 rounded flex flex-col gap-2 font-mono shadow-lg"
                        >
                          <div className="flex justify-between items-center text-[10px] text-[#58A6FF] font-bold">
                            <span>{editingEpIndex !== null ? `✏️ แก้ไขตอน #${editingEpIndex + 1}` : "➕ เพิ่ม EP ใหม่ให้ซีรีส์"}</span>
                            <button onClick={() => setShowAddEpForm(false)} className="text-gray-400 hover:text-white cursor-pointer">
                              <X size={12} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder={`ชื่อตอน e.g. ตอนที่ ${selectedSeries.episodes.length + 1} (EP${String(selectedSeries.episodes.length + 1).padStart(2, '0')})`}
                              value={inputEpTitle}
                              onChange={(e) => setInputEpTitle(e.target.value)}
                              className="bg-[#0D1117] border border-[#2D333B] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#58A6FF]"
                            />
                            <textarea
                              rows={editingEpIndex !== null ? 1 : 2}
                              placeholder="URL สตรีมมิ่ง (m3u8) หรือใส่หลายบรรทัดเพื่อเพิ่มหลาย EP"
                              value={inputEpUrl}
                              onChange={(e) => setInputEpUrl(e.target.value)}
                              className="bg-[#0D1117] border border-[#2D333B] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#58A6FF] resize-none"
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => {
                                setShowAddEpForm(false);
                                setEditingEpIndex(null);
                              }}
                              className="px-2.5 py-1 bg-[#2D333B] text-gray-300 rounded text-[10px] hover:text-white cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                            <button
                              onClick={handleSaveEpisode}
                              className="px-3 py-1 bg-[#58A6FF] hover:bg-blue-400 text-[#0A0C10] font-bold rounded text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Save size={11} />
                              <span>{editingEpIndex !== null ? "บันทึกแก้ไข" : "บันทึก EP"}</span>
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Season Selection Filter and Sort Controls Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5 bg-[#161B22]/80 px-3 py-2 border border-[#2D333B]/60 rounded font-mono">
                      {/* Season selection filter dropdown */}
                      <div className="flex items-center gap-2">
                        <label htmlFor="season-filter-dropdown" className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer">
                          <Layers size={12} className="text-[#58A6FF]" />
                          <span>SEASON:</span>
                        </label>
                        <select
                          id="season-filter-dropdown"
                          value={selectedSeasonFilter}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSelectedSeasonFilter(val === "all" ? "all" : parseInt(val, 10));
                          }}
                          className="bg-[#0D1117] border border-[#2D333B] text-[11px] text-[#58A6FF] rounded px-2.5 py-1 focus:outline-none focus:border-[#58A6FF] font-bold cursor-pointer hover:bg-[#11141b] transition-all"
                        >
                          <option value="all">📁 ทุกซีซั่น / All Seasons ({selectedSeries.episodes.length} eps)</option>
                          {availableSeasons.map(({ seasonNum, count }) => (
                            <option key={seasonNum} value={seasonNum}>
                              🎬 Season {seasonNum} ({count} {count === 1 ? "ep" : "eps"})
                            </option>
                          ))}
                        </select>

                        {selectedSeasonFilter !== "all" && (
                          <button
                            type="button"
                            onClick={() => setSelectedSeasonFilter("all")}
                            className="text-[10px] text-gray-400 hover:text-white hover:underline cursor-pointer font-mono"
                          >
                            [รีเซ็ต]
                          </button>
                        )}
                      </div>

                      {/* Episode Sort Order dropdown */}
                      <div className="flex items-center gap-2">
                        <label htmlFor="episode-sort-dropdown" className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer">
                          <ArrowUpDown size={12} className="text-[#58A6FF]" />
                          <span>SORT:</span>
                        </label>
                        <select
                          id="episode-sort-dropdown"
                          value={episodeSortBy}
                          onChange={(e) => setEpisodeSortBy(e.target.value as any)}
                          className="bg-[#0D1117] border border-[#2D333B] text-[11px] text-gray-200 rounded px-2.5 py-1 focus:outline-none focus:border-[#58A6FF] font-bold cursor-pointer hover:bg-[#11141b] transition-all"
                        >
                          <option value="newest">⬆️ Newest First</option>
                          <option value="oldest">⬇️ Oldest First</option>
                          <option value="season">📁 Season Number</option>
                        </select>
                      </div>
                    </div>

                    {sortedEpisodesWithIndex.length === 0 ? (
                      <div className="p-6 bg-black/30 border border-[#2D333B] rounded text-center text-gray-400 text-xs font-mono flex flex-col items-center justify-center gap-2">
                        <p>ไม่พบตอนย่อยสำหรับเงื่อนไขที่เลือก {selectedSeasonFilter !== "all" ? `(Season ${selectedSeasonFilter})` : ""}</p>
                        {selectedSeasonFilter !== "all" && (
                          <button
                            type="button"
                            onClick={() => setSelectedSeasonFilter("all")}
                            className="px-3 py-1 bg-[#161B22] hover:bg-[#202530] border border-[#2D333B] text-[#58A6FF] rounded text-[10px] cursor-pointer"
                          >
                            ดูทุกซีซั่น (Show All Seasons)
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#2D333B]">
                        {sortedEpisodesWithIndex.map(({ ep, originalIdx, seasonNum }, idx) => {
                          const isPlaying = activeEpisode?.index === originalIdx;
                          return (
                            <div 
                              key={originalIdx}
                              onClick={() => {
                                setActiveEpisode({ title: ep.title, url: ep.url, index: originalIdx });
                                addLog(`🎬 สั่งสตรีมมิ่งตอน: ${selectedSeries.title} - ${ep.title}`, "info");
                              }}
                              className={cn(
                                "border rounded p-2 flex items-center justify-between gap-3 text-xs transition-all cursor-pointer group/item",
                                isPlaying 
                                  ? "bg-[#58A6FF]/10 border-[#58A6FF] text-[#58A6FF]" 
                                  : "bg-[#161B22] hover:bg-[#1a1f29] border-[#2D333B] hover:border-[#58A6FF]/20 text-gray-300"
                              )}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <div className={cn(
                                  "w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors",
                                  isPlaying 
                                    ? "bg-[#58A6FF] text-[#0A0C10]" 
                                    : "bg-[#0D1117] text-gray-400 group-hover/item:text-[#58A6FF] group-hover/item:bg-[#58A6FF]/15"
                                )}>
                                  <Play size={10} fill="currentColor" />
                                </div>
                                {availableSeasons.length > 1 && (
                                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-[#0D1117] text-amber-400 border border-[#2D333B] font-bold flex-shrink-0">
                                    S{seasonNum}
                                  </span>
                                )}
                                <span className={cn(
                                  "font-bold truncate font-mono text-[11px]",
                                  isPlaying ? "text-[#58A6FF]" : "text-gray-200"
                                )}>
                                  {ep.title}
                                </span>
                              </div>
                              
                              <span className="text-[10px] text-gray-500 font-mono break-all flex-1 text-right truncate pl-2">
                                {isPlaying ? "⚡ NOW STREAMING" : ep.url}
                              </span>
                              
                              <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleStartEditEpisode(ep, originalIdx)}
                                  className="p-1 bg-[#010409] hover:bg-[#58A6FF] hover:text-[#0D1117] border border-[#2D333B] rounded text-[10px] text-gray-400 transition-colors cursor-pointer"
                                  title="แก้ไขตอน (EP)"
                                >
                                  <Edit3 size={11} />
                                </button>

                                <button
                                  onClick={() => handleDeleteEpisode(originalIdx)}
                                  className="p-1 bg-[#010409] hover:bg-[#F85149] hover:text-white border border-[#2D333B] rounded text-[10px] text-gray-400 transition-colors cursor-pointer"
                                  title="ลบตอน (EP)"
                                >
                                  <Trash2 size={11} />
                                </button>

                                <button
                                  onClick={() => copyToClipboard(ep.url, `${selectedSeries.id}-${originalIdx}`)}
                                  className="p-1 bg-[#010409] hover:bg-[#58A6FF] hover:text-[#0D1117] border border-[#2D333B] rounded text-[10px] text-gray-400 transition-colors cursor-pointer"
                                  title="ก็อบปี้ลิงค์ M3U8"
                                >
                                  {copiedId === `${selectedSeries.id}-${originalIdx}` ? (
                                    <Check size={11} className="text-[#3FB950]" />
                                  ) : (
                                    <Copy size={11} />
                                  )}
                                </button>
 
                                <a
                                  href={ep.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 bg-[#010409] hover:bg-[#3FB950] hover:text-[#0D1117] border border-[#2D333B] rounded text-[10px] text-gray-400 transition-colors cursor-pointer"
                                  title="เปิดทดสอบสตรีมเมอร์"
                                >
                                  <ExternalLink size={11} />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
 
                {/* Individual M3U console codes preview */}
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex justify-between items-center bg-[#161B22] border border-[#2D333B] px-4 py-2 rounded-t">
                    <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">M3U Content Preview:</span>
                    <button
                      onClick={() => copyToClipboard(generateM3UOfSeries(sortedSeriesForM3U || selectedSeries), "m3u-modal-raw")}
                      className="text-[10px] text-[#58A6FF] hover:text-white font-mono flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === "m3u-modal-raw" ? <Check size={11} /> : <Copy size={11} />}
                      <span>{copiedId === "m3u-modal-raw" ? "COPIED" : "COPY M3U ARRAY"}</span>
                    </button>
                  </div>
                  <pre className="block bg-[#010409] text-[#7EE787] p-3 text-[10px] leading-relaxed rounded-b border border-[#2D333B] max-h-36 overflow-auto font-mono scrollbar-thin scrollbar-thumb-[#2D333B]">
                    {generateM3UOfSeries(sortedSeriesForM3U || selectedSeries)}
                  </pre>
                </div>
              </div>
 
              {/* Bottom footer bar containing merge controls */}
              <div className="p-4 border-t border-[#2D333B] bg-[#161B22] flex items-center justify-between">
                <span className="text-[10px] font-mono text-gray-500">
                  *เพื่อความสะดวก สามารถโหลดไฟล์ M3U ไปใช้เปิดในแอพ IPTV ได้โดยตรง
                </span>
                
                <button
                  onClick={() => downloadM3U(generateM3UOfSeries(sortedSeriesForM3U || selectedSeries), `${selectedSeries.id}-playlist.m3u`)}
                  className="px-3.5 py-1.5 bg-[#58A6FF] hover:bg-blue-400 text-[#0A0C10] font-bold text-xs font-mono rounded transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Download size={12} />
                  <span>DOWNLOAD M3U</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
