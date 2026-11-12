package ru.dndshare.client.updates;

import java.io.*;
import java.net.*;

final class UpdateHttp {
    static java.net.HttpURLConnection open(String address) throws Exception {
        URL url = new URL(address);
        if (!url.getProtocol().equals("https") || !url.getHost().equals("dndshare.ru") || url.getPort() != -1 && url.getPort() != 443) throw new SecurityException("Invalid update origin");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(10000); connection.setReadTimeout(30000);
        connection.setUseCaches(false);
        connection.setRequestProperty("Cache-Control", "no-cache");
        if (connection.getResponseCode() != 200) { connection.disconnect(); throw new IOException("Update server is unavailable"); }
        return connection;
    }
    static byte[] latest(String url) throws Exception {
        HttpURLConnection connection = open(url);
        try (InputStream input = connection.getInputStream()) { return UpdateFiles.read(input, 2 * 1024 * 1024); }
        finally { connection.disconnect(); }
    }
    static void download(String origin, String id, long expectedSize, File target) throws Exception {
        URL base = new URL(origin);
        HttpURLConnection connection = open(new URL(base, "/api/frontend-updates/" + id + ".zip").toString());
        long size = 0;
        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(target)) {
            byte[] buffer = new byte[65536]; int count;
            while ((count = input.read(buffer)) != -1) { size += count; if (size > expectedSize) throw new IOException("Update archive size mismatch"); output.write(buffer,0,count); }
            output.getFD().sync();
            if (size != expectedSize) throw new IOException("Incomplete frontend download");
        } finally { connection.disconnect(); }
    }
}
