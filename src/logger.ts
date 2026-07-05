import { match } from "ts-pattern"

enum LogLevel {
    Debug,
    Info,
    Warn,
    Error
}

let globalLogLevel = LogLevel.Info
export type LogLevelName = "debug" | "info" | "warn" | "error"

export const log = {
    debug: (...data: any[]) => {
        if (globalLogLevel <= LogLevel.Debug)
            console.debug(...data)
    },

    info: (...data: any[]) => {
        if (globalLogLevel <= LogLevel.Info)
            console.info(...data)
    },

    warn: (...data: any[]) => {
        if (globalLogLevel <= LogLevel.Warn)
            console.warn(...data)
    },

    error: (...data: any[]) => {
        if (globalLogLevel <= LogLevel.Error)
            console.error(...data)
    },

    setLevel: (level: LogLevelName) => {
        match(level)
            .with("debug", () => globalLogLevel = LogLevel.Debug)
            .with("info", () => globalLogLevel = LogLevel.Info)
            .with("warn", () => globalLogLevel = LogLevel.Warn)
            .with("error", () => globalLogLevel = LogLevel.Error)
            .exhaustive()
    } 
}
